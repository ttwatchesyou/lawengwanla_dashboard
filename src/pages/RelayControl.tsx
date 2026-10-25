import { subscribeJson } from "../../utils/readPolling";
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import styled from "styled-components";
import Layout from "../../components/Layout/Layout";

type RelayState = { ready: boolean; connected: boolean; ros_connected: boolean; limits_clear: boolean;
  outputs: boolean[] | null; active_level?: string; board_active_level?: string | null; reason?: string | null; requested_channel?: number | null;
  limit_status?: "disconnected" | "stale" | "pressed" | "clear"; pressed_limits?: number[]; ignored_limits?: number[]; motion?: {active: boolean} };
type Gesture = {id: string; channel: number; counter: number; busy: boolean};
const relayMotors = ["ชั้น 3 · ไปขวา", "ชั้น 3 · ไปซ้าย", "ชั้น 2 · ไปขวา", "ชั้น 2 · ไปซ้าย", "ชั้น 1 · ไปซ้าย", "ชั้น 1 · ไปขวา"];
const reasons: Record<string, string> = {
  "Relay polarity not configured": "รอยืนยันว่ารีเลย์เปิดด้วย LOW หรือ HIGH",
  "Floor limit pressed": "ลิมิตประจำชั้นถูกกด · รีเลย์หยุดทุกช่อง",
  "Floor limits not clear or stale": "ลิมิตประจำชั้นยังไม่พร้อม · รีเลย์หยุดทุกช่อง",
  "Relay controller unavailable": "รอการเชื่อมต่อ ROS ตัวควบคุมรีเลย์",
  "Waiting for relay firmware": "รอเฟิร์มแวร์บอร์ดควบคุมรีเลย์",
  "Waiting for relay firmware identity": "รอตรวจสอบบอร์ดควบคุมรีเลย์",
  "Relay feedback timeout or firmware identity not received": "ยังไม่ได้รับข้อมูลจากเฟิร์มแวร์รีเลย์",
  "Verified relay USB adapter not present": "ไม่พบ USB ของบอร์ดควบคุมรีเลย์",
  "Manual button released or heartbeat expired": "ปล่อยปุ่มหรือขาดสัญญาณควบคุม · หยุดแล้ว",
  "Stopped by operator": "สั่งหยุดแล้ว",
  "Relay session initialized; press a new button": "พร้อมรับคำสั่ง · กดค้างเพื่อเปิดรีเลย์",
  "Relay polarity mismatch; reset board after checking wiring": "เลือกโหมดใหม่แล้ว · กด RESET บนบอร์ดรีเลย์เพื่อเปลี่ยน LOW/HIGH",
  "Relay polarity changed; press a new button": "ตั้งค่าโหมดแล้ว · รอข้อมูลยืนยันจากบอร์ด",
};

export default function RelayControl() {
  const [state, setState] = useState<RelayState | null>(null);
  const [holding, setHolding] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [configuring, setConfiguring] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const alive = useRef(true);
  const canRun = !!state?.ros_connected && state.ready && state.limits_clear && !state.motion?.active && !configuring;
  const limitProblem = state?.limit_status === "disconnected" ? "ข้อมูลจากบอร์ดลิมิตขาดหาย · ตรวจไฟเลี้ยงและสาย serial ของบอร์ดลิมิต"
    : state?.limit_status === "stale" ? "ข้อมูลลิมิตหยุดอัปเดต · ระบบตัดรีเลย์ทุกช่อง"
    : state?.limit_status === "pressed" ? `ลิมิตหมายเลข ${state.pressed_limits?.join(", ")} ถูกกด · รีเลย์หยุดทุกช่อง`
    : "ลิมิตประจำชั้นถูกกด หรือข้อมูลลิมิตขาดหาย";
  const canConfigure = !!state?.ros_connected && state.connected && state.limits_clear &&
    holding === null && state.requested_channel == null && state.outputs?.every(value => value === false) && !state.motion?.active && !configuring;
  const configurePolarity = async (active_level: "low" | "high") => {
    if (!canConfigure) return;
    setConfiguring(true); setError("");
    try {
      const response = await fetch("/api/relay/command", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({op: "configure", active_level})});
      if (!response.ok) throw new Error("Configuration rejected");
    } catch { setError("ตั้งค่าไม่ได้ · ตรวจว่าบอร์ดเชื่อมต่อ ลิมิตไม่ถูกกด และรีเลย์หยุดครบแล้ว"); }
    finally { setConfiguring(false); }
  };

  const stop = () => {
    const previous = gesture.current;
    gesture.current = null;
    if (alive.current) setHolding(null);
    void fetch("/api/relay/command", {method: "POST", keepalive: true,
      headers: {"Content-Type": "application/json"}, body: JSON.stringify({op: "stop", ...(previous ? {gesture: previous.id} : {})})
    }).catch(() => { if (alive.current) setError("ส่งคำสั่งหยุดไม่ได้ · ระบบจะตัดเมื่อสัญญาณขาด"); });
  };
  const renew = async (value: Gesture) => {
    if (gesture.current !== value || value.busy) return;
    value.busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300);
    try {
      const response = await fetch("/api/relay/command", {method: "POST", signal: controller.signal,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({op: "hold", gesture: value.id, channel: value.channel, counter: value.counter++})});
      if (!response.ok) throw new Error("Control rejected");
    } catch {
      if (gesture.current === value) {
        stop();
        if (alive.current) setError("คำสั่งถูกหยุด · ตรวจบอร์ดและลิมิต แล้วกดใหม่");
      }
    } finally { value.busy = false; clearTimeout(timeout); }
  };
  const start = (channel: number) => {
    if (!canRun || gesture.current) return;
    const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
    const value = {id: Array.from(bytes, byte => byte.toString(16).padStart(2,"0")).join(""), channel, counter: 0, busy: false};
    gesture.current = value; setHolding(channel); setError(""); void renew(value);
  };

  useEffect(() => {
    alive.current = true;
    let stopped = false;
    const unsubscribe = subscribeJson<RelayState>("/api/relay/state",next=>{
      if(!stopped){setState(next);if(gesture.current && (!next.ready || !next.limits_clear || !next.ros_connected))stop();}
    },()=>{if(!stopped){setState(null);if(gesture.current)stop();}},100,800);
    const heartbeat = setInterval(() => { if (gesture.current) void renew(gesture.current); }, 100);
    const blur = () => { if (gesture.current) stop(); };
    const hidden = () => { if (document.hidden) blur(); };
    window.addEventListener("blur", blur); window.addEventListener("pagehide", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      stopped = true; alive.current = false; unsubscribe(); clearInterval(heartbeat);
      window.removeEventListener("blur", blur); window.removeEventListener("pagehide", blur);
      document.removeEventListener("visibilitychange", hidden);
      if (gesture.current) stop();
    };
  }, []);

  return <Page>
    <Head><title>ควบคุมรีเลย์ · Lawengwanla</title></Head>
    <Content>
      <Heading><div><small>MANUAL CONTROL</small><h1>ควบคุมรีเลย์</h1><p>กดค้างเพื่อเปิดทีละช่อง · ปล่อยปุ่มเพื่อหยุด</p></div><Link href="/SensorCheck">ดูเซนเซอร์ →</Link></Heading>
      <Status $ready={canRun} role="status"><strong>{canRun ? "พร้อมควบคุม" : "ยังเปิดรีเลย์ไม่ได้"}</strong><span>{canRun ? "กดค้างเพื่อเปิดรีเลย์ทีละช่อง · ปล่อยเพื่อหยุด" : !state ? "รอระบบควบคุมรีเลย์" : !state.limits_clear && state.ready ? limitProblem : reasons[state.reason ?? ""] ?? state.reason ?? "กดปุ่มค้างเพื่อควบคุม"}</span></Status>
      <Info><span>ROS <b>{state?.ros_connected ? "เชื่อมต่อ" : "รอเชื่อมต่อ"}</b></span><span>STM32 <b>{state?.connected ? "เชื่อมต่อ" : "รอเชื่อมต่อ"}</b></span><span>ลิมิต 3 ชั้น <b>{state?.limits_clear ? "ปลอดการกด" : "หยุด / รอข้อมูล"}</b></span></Info>
      {state?.ignored_limits?.includes(3) && <BypassNotice data-testid="ignored-limit-notice">ข้ามลิมิต 3 / PA8 ชั่วคราว · ลิมิตอีก 5 จุดยังหยุดรีเลย์ตามปกติ</BypassNotice>}
      <PolarityPanel aria-label="โหมดรีเลย์"><div><strong>เลือกโหมดเพื่อเริ่มทดสอบ</strong><small>เลือก LOW หรือ HIGH ให้ตรงกับโมดูลรีเลย์ · เลือกผิดอาจทำให้รีเลย์ทำงานกลับด้าน</small><small>เปลี่ยน LOW/HIGH หลังเริ่มใช้แล้ว ต้องกด RESET บนบอร์ดรีเลย์</small></div><div>{(["low", "high"] as const).map(level => <button key={level} type="button" disabled={!canConfigure} aria-pressed={state?.active_level === level} onClick={() => void configurePolarity(level)} data-testid={`relay-mode-${level}`}>{level.toUpperCase()}{state?.active_level === level ? " ✓" : ""}</button>)}</div></PolarityPanel>
      <p><Link href="/SensorCheck#io595">บอร์ดใหม่ · ควบคุมรีเลย์ 16 ช่องและดูเซนเซอร์ →</Link></p>
      <Grid>{[0,1,2,3,4,5].map(index => {
        const output = state?.outputs?.[index];
        return <Card key={index} $on={output === true}>
          <CardTop><strong>รีเลย์ {index + 1}</strong><code>A{index} / PA{index}</code></CardTop>
          <Output $on={output === true}>{output === undefined ? "รอข้อมูลบอร์ด" : output ? "เปิดอยู่" : "ปิดอยู่"}</Output>
          <p>{relayMotors[index]}</p>
          <Hold type="button" disabled={!canRun || (holding !== null && holding !== index)} $held={holding === index}
            aria-label={`กดค้างเปิดรีเลย์ ${index+1}`} aria-pressed={holding === index} data-testid={`relay-${index}`}
            onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start(index); }}
            onPointerUp={() => { if (gesture.current?.channel === index) stop(); }}
            onPointerCancel={() => { if (gesture.current?.channel === index) stop(); }}
            onLostPointerCapture={() => { if (gesture.current?.channel === index) stop(); }}
            onContextMenu={event => event.preventDefault()}
            onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start(index); } }}
            onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (gesture.current?.channel === index) stop(); } }}
            onBlur={() => { if (gesture.current?.channel === index) stop(); }}>
            {holding === index ? "กำลังส่งคำสั่ง · ปล่อยเพื่อหยุด" : "กดค้างเพื่อเปิด"}
          </Hold>
        </Card>;
      })}</Grid>
      <Stop type="button" onClick={stop}>หยุดรีเลย์ทุกช่อง</Stop>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      <Footnote>กดลิมิตซ้าย–ขวาที่ใช้งานอยู่ตัวใดในสามชั้น ระบบจะหยุดรีเลย์ทุกช่อง ต้องปล่อยปุ่มแล้วกดใหม่หลังลิมิตพ้น<br/>หากปิดหน้าเว็บ การเชื่อมต่อขาด หรือข้อมูลลิมิตหยุด ระบบจะตัดการทำงาน</Footnote>
    </Content>
  </Page>;
}
RelayControl.getLayout = (page: React.ReactElement) => <Layout hideFooter>{page}</Layout>;
const Page = styled.main`min-height:100dvh;padding:94px 22px 30px;background:#f6f4e8;color:#203651;@media(max-width:600px){padding:84px 12px 22px}`;
const Content = styled.div`max-width:1080px;margin:auto;`;
const Heading = styled.header`display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px;small{font-size:10px;letter-spacing:2px;color:#73838a}h1{font-size:30px;margin:4px 0}p{margin:0;color:#6c7d86;font-size:13px}a{color:#326e68;font-size:13px}`;
const Status = styled.div<{$ready:boolean}>`display:flex;gap:8px;flex-direction:column;padding:16px 20px;border-radius:16px;border:1px solid ${({$ready})=>$ready?"#99cbb3":"#dfc69c"};background:${({$ready})=>$ready?"#e4f1e7":"#fbf0db"};strong{font-size:16px}span{font-size:12px}`;
const Info = styled.div`display:flex;gap:20px;flex-wrap:wrap;padding:16px 3px;font-size:12px;color:#7e8d95;b{color:#365460;margin-left:6px;font-weight:500}`;
const BypassNotice = styled.p`margin:0 0 16px;padding:10px 14px;border:1px solid #dfc69c;border-radius:10px;color:#8a672d;background:#fbf0db;font-size:12px;`;
const PolarityPanel = styled.section`display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;margin-bottom:16px;border:1px solid #cfdbd7;border-radius:14px;background:#fffef7;strong{font-size:13px}small{display:block;font-size:11px;line-height:1.7;color:#72838b}div:last-child{display:flex;gap:8px;flex-shrink:0}button{border:1px solid #688888;border-radius:8px;padding:10px 18px;color:#254b50;background:#edf3ee;font:inherit;font-size:13px;cursor:pointer}button[aria-pressed="true"]{background:#254b50;color:white}button:disabled{opacity:.45;cursor:default}@media(max-width:600px){align-items:flex-start;flex-direction:column}`;
const Grid = styled.div`display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;@media(max-width:760px){grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:420px){grid-template-columns:1fr}`;
const Card = styled.section<{$on:boolean}>`background:${({$on})=>$on?"#e0f2e8":"#fffef7"};border:1px solid ${({$on})=>$on?"#64b291":"#dde3df"};border-radius:18px;padding:20px;p{font-size:11px;color:#7b8991;margin:6px 0 18px}`;
const CardTop = styled.div`display:flex;justify-content:space-between;align-items:center;gap:10px;strong{font-size:17px}code{font-size:11px;color:#6f8a92}`;
const Output = styled.div<{$on:boolean}>`font-size:23px;font-weight:600;margin-top:20px;color:${({$on})=>$on?"#207553":"#81939b"};`;
const Hold = styled.button<{$held:boolean}>`width:100%;border:0;border-radius:10px;padding:14px 5px;background:${({$held})=>$held?"#278265":"#203d55"};color:white;font:inherit;font-size:12px;cursor:pointer;touch-action:none;user-select:none;:disabled{background:#dfe5e1;color:#8c999d;cursor:default}:focus-visible{outline:3px solid #e1ae4c;outline-offset:3px}`;
const Stop = styled.button`width:100%;padding:17px;margin-top:20px;border:1px solid #b75a51;border-radius:12px;background:#ab4139;color:white;font:inherit;font-size:17px;font-weight:600;cursor:pointer;:focus-visible{outline:3px solid #edba55;outline-offset:3px}`;
const ErrorText = styled.p`font-size:13px;color:#a3443b;`;
const Footnote = styled.p`font-size:12px;line-height:1.9;color:#7c898f;text-align:center;margin-top:18px;`;
