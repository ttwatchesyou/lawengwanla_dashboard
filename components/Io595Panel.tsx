import { subscribeJson } from "../utils/readPolling";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Io595Packet, Io595State, LIMIT_INPUTS, NANO_INPUTS, RELAY_GROUPS, io595Live, io595SensorsLive, io595RelayLevel, parseIo595 } from "../utils/io595";

type Gesture = {id: string; channel: number; counter: number; busy: boolean};
export default function Io595Panel({ unmappedOnly = false }: { unmappedOnly?: boolean }) {
  const received = useRef<{state: Io595State; at: number} | null>(null);
  const feedError = useRef(false);
  const displayKey = useRef("");
  const [display, setDisplay] = useState<{packet: Io595Packet | null; live: boolean; ready: boolean; relayFresh: boolean}>({packet: null, live: false, ready: false, relayFresh: false});
  const [holding, setHolding] = useState<number | null>(null);
  const [error, setError] = useState("");
  const gesture = useRef<Gesture | null>(null);
  const mounted = useRef(true);
  const {packet, live, ready, relayFresh} = display;

  const stop = (all = false) => {
    const previous = gesture.current;
    gesture.current = null;
    if (mounted.current) setHolding(null);
    void fetch("/api/io595/command", {method: "POST", keepalive: true,
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({op: "stop", ...(!all && previous ? {gesture: previous.id} : {})})
    }).catch(() => { if (mounted.current) setError("ส่งคำสั่งหยุดไม่ได้ · รอตัดเมื่อสัญญาณขาด"); });
  };
  const renew = async (current: Gesture) => {
    if (gesture.current !== current || current.busy) return;
    current.busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 250);
    try {
      const response = await fetch("/api/io595/command", {method: "POST", signal: controller.signal,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({op: "hold", gesture: current.id, channel: current.channel, counter: current.counter++})});
      if (!response.ok) throw new Error("Hold rejected");
    } catch {
      if (gesture.current === current) {
        stop();
        if (mounted.current) setError("คำสั่งหยุดแล้ว · ตรวจการเชื่อมต่อแล้วกดใหม่");
      }
    } finally { clearTimeout(timeout); current.busy = false; }
  };
  const start = (channel: number) => {
    const latest = received.current;
    if (!ready || feedError.current || !latest?.state.ready || !io595Live(latest.state, performance.now() - latest.at) || gesture.current) return;
    const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
    const current = {id: Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(""), channel, counter: 0, busy: false};
    gesture.current = current; setHolding(channel); setError(""); void renew(current);
  };

  const refreshDisplay = () => {
    const latest = received.current;
    const elapsed = latest ? performance.now() - latest.at : 0;
    const state = latest?.state ?? null;
    const live = io595SensorsLive(state, elapsed);
    const relayFresh = !feedError.current && io595Live(state, elapsed);
    const ready = relayFresh && !!state?.ready && !state?.packet?.floor3?.active && !state?.packet?.floor2?.active && !state?.packet?.floor1?.active && !state?.packet?.front?.active;
    const packet = live ? state!.packet : null;
    // Sequence/ACK/timestamp updates alone do not change any visible indicator.
    const key = JSON.stringify([live, ready, relayFresh, packet?.mask, packet?.active_level, packet?.nano_levels, packet?.limit_levels, packet?.floor3, packet?.floor2, packet?.floor1]);
    if (key !== displayKey.current) {
      displayKey.current = key;
      setDisplay({packet, live, ready, relayFresh});
    }
    if (!ready && gesture.current) stop();
  };

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const unsubscribe = subscribeJson<any>("/api/io595/state", (data,stamp)=>{
      if(disposed)return;
      const state=parseIo595(data);
      received.current=state?{state,at:stamp.requestedAt}:null;
      feedError.current=false;refreshDisplay();
    },()=>{
      if(!disposed){feedError.current=true;refreshDisplay();if(gesture.current)stop();}
    },80,800);
    const heartbeat = setInterval(() => {
      if (gesture.current) void renew(gesture.current);
    }, 80);
    const expiry = setInterval(() => { if (!document.hidden) refreshDisplay(); }, 100);
    const blur = () => { if (gesture.current) stop(); };
    const hidden = () => { if (document.hidden) { blur(); } };
    window.addEventListener("blur", blur); window.addEventListener("pagehide", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      disposed = true; mounted.current = false;
      unsubscribe(); clearInterval(heartbeat); clearInterval(expiry);
      window.removeEventListener("blur", blur); window.removeEventListener("pagehide", blur);
      document.removeEventListener("visibilitychange", hidden);
      if (gesture.current) stop();
    };
  }, []);
  useEffect(() => { if (!ready && gesture.current) stop(); }, [ready]);

  return <Panel id={unmappedOnly ? "unmapped-relays" : "io595-details"} aria-label={unmappedOnly ? "รีเลย์ที่ยังไม่แมพ" : "บอร์ด STM32 ใหม่ ลิมิต อินดัก และรีเลย์"}>
    <Top><div><small>STM32F103C8T6 · NANO · 74HC595 × 2</small><h2>{unmappedOnly ? "รีเลย์ที่ยังไม่แมพ · ช่อง 7–16" : "บอร์ดใหม่ · เซนเซอร์ มอเตอร์ และแม่เหล็ก"}</h2></div><Status role="status">{ready ? "พร้อมทดสอบ" : live ? "เชื่อมต่อ · รอพร้อมควบคุม" : "รอเชื่อมต่อบอร์ดใหม่"}</Status></Top>
    {unmappedOnly && <Note>กดค้างเพื่อเปิดทีละช่อง · ปล่อยเพื่อปิด · ช่อง 7–8 ยังไม่ระบุหน้าที่ / ช่อง 9–14 มอเตอร์ยังไม่ระบุตัวและทิศทาง / ช่อง 15–16 แม่เหล็กยังไม่ระบุตำแหน่ง</Note>}
    {!unmappedOnly && <>
    <Note>กดค้างเปิดได้ครั้งละ 1 ช่อง ปล่อยเพื่อปิด · ชั้น 3: ช่อง 2 ซ้าย หยุด L4 / ช่อง 1 ขวา หยุด L5</Note>
    {packet?.floor3 && <Note role="status">ชั้น 3: {packet.floor3.state} · ตำแหน่ง {packet.floor3.position}
      {packet.floor3.active ? " · กำลังทำงานอัตโนมัติ กดปิดทั้งหมดเพื่อหยุด" : ""}
      {!packet.floor3.center_configured ? " · ยังไม่ตั้งเซนเซอร์กลาง" : ""}
      {packet.floor3.error ? ` · ${packet.floor3.error}` : ""}</Note>}
    {packet?.parallel_sliders && <Note>อัตโนมัติทั้ง 3 ชั้นทำงานพร้อมกันได้ · หยุดตามเซนเซอร์แต่ละชั้น · ไม่มี timeout การเดินทาง</Note>}
    <Note>ชั้น 2: ช่อง 4 ซ้าย หยุด PA2 / ช่อง 3 ขวา หยุด PA3 / กลาง PB5</Note>
    {packet?.floor2 && <Note role="status">ชั้น 2: {packet.floor2.state} · ตำแหน่ง {packet.floor2.position}
      {packet.floor2.active ? " · กำลังทำงานอัตโนมัติ กดปิดทั้งหมดเพื่อหยุด" : ""}
      {packet.floor2.error ? ` · ${packet.floor2.error}` : ""}</Note>}
    <Note>ชั้น 1: ช่อง 5 ซ้าย หยุด PA0 / ช่อง 6 ขวา หยุด PA1 / กลาง PB0</Note>
    {packet?.floor1 && <Note role="status">ชั้น 1: {packet.floor1.state} · ตำแหน่ง {packet.floor1.position}
      {packet.floor1.active ? " · กำลังทำงานอัตโนมัติ กดปิดทั้งหมดเพื่อหยุด" : ""}
      {packet.floor1.error ? ` · ${packet.floor1.error}` : ""}</Note>}
    <h3>ลิมิต L1–L8</h3>
    <Inputs>{LIMIT_INPUTS.map((pin, i) => {
      const level = packet?.limit_levels[i];
      return <Input key={pin} $active={level === 0}><strong>L{i + 1} <code>{pin}</code></strong><span>{level === undefined ? "รอข้อมูล" : level === 0 ? "กดอยู่ · LOW" : "ไม่กด · HIGH"}</span></Input>;
    })}</Inputs>
    <h3>อินดักจาก Nano I1–I4</h3>
    <Inputs>{NANO_INPUTS.map((pin, i) => {
      const level = packet?.nano_levels[i];
      return <Input key={pin} $active={level === 0}><strong>I{i + 1} <code>{pin}</code></strong><span>{level === undefined ? "รอข้อมูล" : level === 0 ? "ตรวจพบ · LOW" : "ไม่พบ · HIGH"}</span></Input>;
    })}</Inputs>
    </>}
    {RELAY_GROUPS.map(group => ({...group, outputs: group.outputs.filter(({channel}) => !unmappedOnly || channel >= 7)})).map(group => <div key={group.title}><h3>{group.title}</h3><Relays>{group.outputs.map(({channel, output, label}) => {
      const on = relayFresh && !!packet && (packet.mask & (1 << (channel - 1))) !== 0;
      return <Relay key={channel} $active={on}>
        <strong>{label}</strong>{channel >= 7 && <span>ยังไม่แมพ{channel >= 15 ? "ตำแหน่งแม่เหล็ก" : channel >= 9 ? "ตัวมอเตอร์และทิศทาง" : "หน้าที่"}</span>}<code>บอร์ด {group.board} · {output} · ช่อง {channel}</code><span>{!relayFresh || !packet ? "รอยืนยันคำสั่ง" : `${on ? "รับคำสั่งเปิด" : "คำสั่งปิด"} · ${io595RelayLevel(packet, on)}`}</span>
        <button type="button" disabled={!ready || (holding !== null && holding !== channel)} aria-label={`กดค้างเปิดบอร์ด ${group.board} ${label}`} aria-pressed={holding === channel}
          onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start(channel); }}
          onPointerUp={() => { if (gesture.current?.channel === channel) stop(); }}
          onPointerCancel={() => { if (gesture.current?.channel === channel) stop(); }}
          onLostPointerCapture={() => { if (gesture.current?.channel === channel) stop(); }}
          onContextMenu={event => event.preventDefault()}
          onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start(channel); } }}
          onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (gesture.current?.channel === channel) stop(); } }}
          onBlur={() => { if (gesture.current?.channel === channel) stop(); }}>
          {holding === channel ? "ปล่อยเพื่อปิด" : "กดค้างเปิด"}
        </button>
      </Relay>;
    })}</Relays></div>)}
    <Note>สถานะรีเลย์แสดงคำสั่งที่ STM32 รับแล้ว ยังไม่ได้วัดสัญญาณออกจาก 74HC595 หรือหน้าสัมผัสรีเลย์</Note>
    <Stop type="button" onClick={() => stop(true)}>ปิดรีเลย์บอร์ดใหม่ทั้งหมด</Stop>
    {error && <Note role="alert">{error}</Note>}
  </Panel>;
}

const Panel = styled.section`scroll-margin-top:90px;padding:20px;margin-bottom:24px;border:1px solid #cddbd3;border-radius:18px;background:#fffef7;color:#203651;h2{font-size:19px;margin:5px 0}h3{font-size:13px;margin:18px 0 9px}`;
const Top = styled.div`display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;small{font-size:10px;letter-spacing:1px;color:#6f828a}`;
const Status = styled.span`font-size:12px;color:#365e60;background:#edf2e9;border-radius:9px;padding:9px 12px`;
const Note = styled.p`font-size:12px;line-height:1.7;color:#6a7e88;margin:8px 0`;
const Inputs = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px`;
const Input = styled.div<{$active:boolean}>`display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid ${({$active})=>$active?"#76b59a":"#dce2dc"};border-radius:10px;background:${({$active})=>$active?"#e2f3e7":"#f5f6ef"};strong{font-size:13px}code{font-size:10px;font-weight:400;margin-left:6px}span{font-size:11px;color:#58747b}`;
const Relays = styled.div`
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;
  @media(max-width:900px){grid-template-columns:repeat(2,minmax(0,1fr))}
  @media(max-width:540px){grid-template-columns:minmax(0,1fr)}
`;
const Relay = styled.div<{$active:boolean}>`
  display:flex;flex-direction:column;gap:10px;min-width:0;padding:18px;
  border:1px solid ${({$active})=>$active?"#68ac8d":"#dce2dc"};border-radius:14px;
  background:${({$active})=>$active?"#dff2e7":"#f6f6ef"};
  strong{font-size:20px}code,span{font-size:13px;color:#68818a}
  button{width:100%;min-height:88px;margin-top:6px;border:0;border-radius:12px;
    padding:18px 12px;background:#24445a;color:#fff;font:inherit;font-size:22px;
    font-weight:700;line-height:1.4;touch-action:none;user-select:none;cursor:pointer}
  button[aria-pressed=true]{background:#278265}
  button:focus-visible{outline:3px solid #278265;outline-offset:4px}
  button:disabled{opacity:.4;cursor:default}
`;
const Stop = styled.button`
  width:100%;min-height:76px;margin-top:24px;padding:18px;
  border:2px solid #d7a7a0;border-radius:12px;background:#faeae4;color:#9b3e33;
  font:inherit;font-size:20px;font-weight:700;cursor:pointer;touch-action:manipulation;
`;
