import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { subscribeJson } from "../utils/readPolling";
import { useReadClock } from "../utils/useReadClock";

type ServoState = {
  connected: boolean; ready: boolean; servo_capable?: boolean; servo_only?: boolean;
  servo_angles?: number[] | null; age_ms: number | null;
  connection_epoch?: string; stop_generation?: number;
  autoconnect?: { error?: string | null }; error?: string | null;
};
const pins = ["PA11", "PA12", "PA15"];
export default function ServoCalibrationPanel() {
  const [state, setState] = useState<ServoState | null>(null);
  const [at, setAt] = useState(0);
  const [angles, setAngles] = useState([90, 90, 90]);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const locked = useRef(false), mounted = useRef(true);
  const now = useReadClock(100);
  const fresh = !!(state?.ready && state.servo_capable && state.age_ms !== null && state.age_ms + Math.max(0, now - at) < 400);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeJson<ServoState>("/api/gripper-axes/state", (value, stamp) => {
      setState(value); setAt(stamp.requestedAt);
    }, cause => { setState(null); setMessage(cause.message); }, 200, 900);
    return () => { mounted.current = false; unsubscribe(); };
  }, []);
  const send = async (index: number) => {
    const angle = angles[index];
    if (!fresh || !state || locked.current || !Number.isInteger(angle) || angle < 0 || angle > 180) return;
    locked.current = true; setBusy(index); setMessage("");
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const requestedAt = performance.now();
      const response = await fetch("/api/gripper-axes/command", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "servo", servo_id: index + 1, angle,
          connection_epoch: state.connection_epoch, stop_generation: state.stop_generation }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "ส่งคำสั่ง servo ไม่สำเร็จ");
      if (mounted.current) {
        setState(result); setAt(requestedAt);
        setMessage(`บอร์ดยืนยันคำสั่ง Servo ${index + 1}: ${result.servo_angles?.[index] ?? "—"}°`);
      }
    } catch (cause) { if (mounted.current) setMessage((cause as Error).message); }
    finally { clearTimeout(timeout); locked.current = false; if (mounted.current) setBusy(null); }
  };
  const update = (index: number, value: number) => setAngles(previous => previous.map((angle, i) => i === index ? value : angle));
  return <Panel aria-label="ปรับมุม servo">
    <h2>ปรับมุม Servo 1–3</h2>
    <p role="status">{fresh ? "เชื่อมต่อ · พร้อมสั่งมุม" : state?.connected ? "รอเฟิร์มแวร์ servo และข้อมูลสด" : "รอบอร์ด servo · เชื่อมต่ออัตโนมัติ"}</p>
    <p>บอร์ดเริ่มที่ 90° ทั้งสามตัวเมื่อเปิดเครื่องหรือรีเซ็ต · ปรับค่าแล้วกดส่งแต่ละตัว</p>
    <Grid>{pins.map((pin, index) => <form key={pin} onSubmit={event => { event.preventDefault(); void send(index); }}>
      <h3>Servo {index + 1} · {pin}</h3>
      <p>มุมคำสั่งจากบอร์ด: <strong>{fresh && state?.servo_angles ? `${state.servo_angles[index]}°` : "—"}</strong></p>
      <label htmlFor={`servo-angle-${index}`}>มุมที่ต้องการ (0–180°)</label>
      <input id={`servo-angle-${index}`} type="number" min="0" max="180" step="1" required value={Number.isNaN(angles[index]) ? "" : angles[index]} disabled={busy !== null}
        onChange={event => update(index, event.target.valueAsNumber)} />
      <input aria-label={`แถบปรับมุม Servo ${index + 1}`} type="range" min="0" max="180" step="1" value={Number.isFinite(angles[index]) ? Math.max(0, Math.min(180, angles[index])) : 90}
        disabled={busy !== null} onChange={event => update(index, Number(event.target.value))} />
      <button type="submit" disabled={!fresh || busy !== null || !Number.isInteger(angles[index]) || angles[index] < 0 || angles[index] > 180}>{busy === index ? "กำลังส่ง…" : `ส่งมุม Servo ${index + 1}`}</button>
    </form>)}</Grid>
    <small>ค่าที่แสดงเป็นมุมคำสั่ง ไม่มีเซนเซอร์วัดมุมเพลาจริง · การออกจากหน้าเว็บไม่เปลี่ยนมุมที่สั่งไว้</small>
    {state?.servo_only && <p>โหมดปรับ servo: stepping ชุดขึ้น–ลง และรีเลย์ปิดการทำงาน</p>}
    {(message || state?.error || state?.autoconnect?.error) && <p role="status">{message || state?.error || state?.autoconnect?.error}</p>}
  </Panel>;
}
const Panel = styled.section`margin:22px 0;padding:24px;border-radius:18px;background:white;border:1px solid #d9e2e8;color:#203651;h2{margin-top:0}p{line-height:1.6}small{color:#65798a}button,input{font:inherit}button{padding:12px;border:0;border-radius:8px;background:#176649;color:white;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}input[type=number]{padding:9px;width:100%;border:1px solid #a8bbc9;border-radius:7px}input[type=range]{width:100%;margin:16px 0}`;
const Grid = styled.div`display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:20px 0;form{display:flex;flex-direction:column;padding:18px;background:#f2f7fa;border:1px solid #d9e2e8;border-radius:12px}label{margin-bottom:8px}h3{margin-top:0}@media(max-width:750px){grid-template-columns:1fr}`;
