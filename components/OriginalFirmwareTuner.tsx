import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NumericField } from "./tuner/NumericField";
import { startVisiblePolling, readWasCancelled } from "../utils/readPolling";
import { originalRequest, type OriginalAction, type OriginalContract, type Gains } from "../utils/originalTuner";
import type { WheelTelemetry, WheelSample, WheelReadback } from "../utils/originalTuner";
import OriginalWheelTuning from "./OriginalWheelTuning";
import { Page, PageHeader, Panel, PanelHeading, Note, ActionButton, SendButton, StopButton,
  ConnectionBadge, TunerLayout, TunerControls, TunerReadout } from "./tuner/RobotTuner.styles";

type Pose = { x: number; y: number; yaw: number; tick_x: number; tick_y: number };
type Sample = Pose & { seq: number; t: number; requested_x?: number; requested_y?: number; requested_yaw?: number };
type Sent = { command: string; acknowledged: boolean; sent_at: number };
type State = { connected: boolean; protocol?: string; pose_fresh?: boolean; error?: string;
  goal_status?: { state: string; received_at: number };
  pose?: Pose; pose_samples?: Sample[]; pose_sequence?: number; last_line?: string;
  last_sent?: Sent; requested_motion?: string; requested_goal?: { x: number; y: number; yaw: number } };
type WheelState = { wheel_telemetry?: WheelTelemetry; telemetry_samples?: WheelSample[]; telemetry_sequence?: number;
  telemetry_fresh?: boolean; wheel_pid_readback?: WheelReadback };
const base = process.env.NEXT_PUBLIC_ROBOT_API || "";
async function api(path: string, body?: Record<string, unknown>, signal?: AbortSignal) {
  const r = await fetch(base + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store", signal });
  const result = await r.json();
  if (!r.ok || result.status === "error") throw Error(result.detail || `HTTP ${r.status}`);
  return result;
}
const n = (v?: number, digits = 3) => Number.isFinite(v) ? v!.toFixed(digits) : "—";
const goalStatusText: Record<string, string> = {
  RUNNING: "กำลังเข้าเป้า",
  DONE: "เข้าเป้าและนิ่งแล้ว · หยุดจ่าย PWM",
  NEAR_TIMEOUT: "หยุด: พยายามใกล้เป้าเกินเวลา · กด STOP ก่อนลองเป้าเดิมใหม่",
  NO_PROGRESS_XY: "หยุด: ตำแหน่งไม่คืบหน้า · กด STOP ก่อนลองเป้าเดิมใหม่",
  NO_PROGRESS_YAW: "หยุด: มุมไม่คืบหน้า · กด STOP ก่อนลองเป้าเดิมใหม่",
};

function Plot({ title, rows, lines, unit }: { title: string; rows: Sample[]; lines: { key: string; label: string; color: string; dashed?: boolean }[]; unit: string }) {
  return <Panel><PanelHeading>{title}</PanelHeading><Chart>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={rows}>
      <CartesianGrid stroke="#253754" strokeDasharray="3 3" />
      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={v => Number(v).toFixed(1)} stroke="#9db0ce" />
      <YAxis stroke="#9db0ce" /><Tooltip labelFormatter={v => `เวลารับข้อมูล ${Number(v).toFixed(2)} s`} />
      {lines.map(line => <Line key={line.key} type="linear" dataKey={line.key} name={line.label} stroke={line.color}
        strokeDasharray={line.dashed ? "5 4" : undefined} dot={false} isAnimationActive={false} connectNulls={false} />)}
    </LineChart></ResponsiveContainer>
  </Chart><Note>{lines.map(line => line.label).join(" · ")} · {unit} · เวลาอ้างอิงฝั่งเว็บ</Note></Panel>;
}

export default function OriginalFirmwareTuner({ contract }: { contract: OriginalContract }) {
  const p = contract.position;
  const [state, setState] = useState<State & WheelState>({ connected: false });
  const [rows, setRows] = useState<Sample[]>([]);
  const [wheelRows, setWheelRows] = useState<WheelSample[]>([]);
  const [stopEpoch, setStopEpoch] = useState(0);
  const [goal, setGoal] = useState({ x: 0, y: 0, yaw: 0 });
  const [velocity, setVelocity] = useState({ vx: 0, vy: 0 });
  const [speed, setSpeed] = useState(p.cruise_mps);
  const [xPid, setXPid] = useState<Gains>({ ...p.x });
  const [yPid, setYPid] = useState<Gains>({ ...p.y });
  const [yawPid, setYawPid] = useState({ max_rpm: p.yaw_max_rpm, kp: p.yaw_kp, kd: p.yaw_kd });
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("ค่าในฟอร์มเป็นค่าเริ่มต้นจาก source ยังไม่ได้ส่งไปบอร์ด");
  const [sent, setSent] = useState<Partial<Record<OriginalAction, Sent>>>({});
  const cursor = useRef(0);
  const wheelCursor = useRef(0);
  const pendingMotion = useRef<Promise<any> | null>(null);
  const motionRequested = useRef(false);
  const generation = useRef(0);
  const fresh = !!(state.connected && state.protocol === "stm32_original_gvps" && state.pose_fresh);

  const stop = async () => {
    generation.current++; motionRequested.current = false; setArmed(false);
    setStopEpoch(v => v + 1);
    try {
      await api("/api/tuner/command", { action: "stop" });
      if (pendingMotion.current) { await pendingMotion.current.catch(() => {}); await api("/api/tuner/command", { action: "stop" }); }
      setMessage("ส่ง X (STOP) แล้ว · ดู RPM/PWM และสถานะหยุดจากข้อมูล WHEEL ล่าสุด");
    } catch (e) { setMessage(`ส่ง X ไม่สำเร็จ: ${(e as Error).message}`); }
  };

  useEffect(() => {
    const reader = startVisiblePolling(async signal => {
      try {
        const next: State & WheelState = await api(`/api/tuner/state?pose_after=${cursor.current}&telemetry_after=${wheelCursor.current}`, undefined, signal);
        if (signal.aborted) return;
        const restarted = (next.pose_sequence ?? 0) < cursor.current;
        cursor.current = next.pose_sequence ?? 0; setState(next);
        if (next.pose_samples?.length) setRows(old => [...(restarted ? [] : old), ...next.pose_samples!].slice(-600));
        const wheelRestarted = (next.telemetry_sequence ?? 0) < wheelCursor.current;
        wheelCursor.current = next.telemetry_sequence ?? 0;
        if (next.telemetry_samples?.length) setWheelRows(old => {
          const samples = next.telemetry_samples!.filter(row => row.version === 1);
          const reset = wheelRestarted || (old.length > 0 && samples.length > 0 && samples[0].ms < old[old.length-1].ms);
          return [...(reset ? [] : old), ...samples].slice(-600);
        });
      } catch (e) { if (!readWasCancelled(signal)) { setState({ connected: false }); setMessage((e as Error).message); } }
    }, 200, { timeoutMs: 1800 });
    const onBlur = () => { if (motionRequested.current) void stop(); };
    const onVisibility = () => { if (document.hidden) onBlur(); };
    window.addEventListener("blur", onBlur); document.addEventListener("visibilitychange", onVisibility);
    return () => { reader.stop(); window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onVisibility); onBlur(); };
  }, []);
  useEffect(() => { if (!fresh) { setArmed(false); if (motionRequested.current) void stop(); } }, [fresh]);

  const send = async (action: OriginalAction, values: Record<string, unknown> = {}) => {
    const moves = action === "goal" || action === "twist" || action === "wheel_rpm";
    if (moves && (!fresh || (action !== "wheel_rpm" && !armed))) return false;
    setBusy(true); const token = generation.current;
    try {
      const body = originalRequest(action, values);
      if (moves) { motionRequested.current = true; setArmed(false); }
      const request = api("/api/tuner/command", body);
      if (moves) pendingMotion.current = request;
      const result = await request;
      if (moves && token !== generation.current) return false;
      setSent(old => ({ ...old, [action]: result }));
      setMessage(result.acknowledged ? `บอร์ดยืนยัน PID ${values.wheel}: ${result.gains.kp} / ${result.gains.ki} / ${result.gains.kd}` : `ส่ง ${result.command} ทาง UART แล้ว · ดูข้อมูลที่บอร์ดรายงานล่าสุด`);
      return true;
    } catch (e) { setMessage((e as Error).message); if (moves) await stop(); return false; }
    finally { if (moves) pendingMotion.current = null; setBusy(false); }
  };
  const connect = async () => {
    setBusy(true);
    try { await api("/api/tuner/connect", { port: "auto", baud: 115200 }); cursor.current = 0; wheelCursor.current = 0; setRows([]); setWheelRows([]); setSent({}); setMessage("เชื่อมพอร์ตล้อและส่ง X แล้ว รอข้อมูลสด"); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  };
  const latest = (action: OriginalAction) => sent[action] && <Note>ล่าสุดที่เว็บส่ง: <code>{sent[action]!.command}</code> · ไม่มี ACK</Note>;
  const pidCard = (label: string, gains: Gains, set: (value: Gains) => void, action: "pos_pid_x" | "pos_pid_y") =>
    <Panel><PanelHeading>{label} · {action === "pos_pid_x" ? "P6" : "P7"}</PanelHeading><Fields>
      {(["kp", "ki", "kd"] as const).map(key => <NumericField key={key} label={key.toUpperCase()} value={gains[key]} onChange={v => set({ ...gains, [key]: v })} />)}
    </Fields><SendButton disabled={!fresh || busy} onClick={() => void send(action, gains)}>ส่ง {label}</SendButton>{latest(action)}</Panel>;
  const extent = Math.max(.5, ...rows.flatMap(row => [Math.abs(row.x), Math.abs(row.y)]), Math.abs(state.requested_goal?.x || 0), Math.abs(state.requested_goal?.y || 0));
  const point = (x: number, y: number) => `${160+x*135/extent},${160-y*135/extent}`;
  return <Page>
    <Header><div><h1>STM32 Tuner · G / V / X / Z / S / P</h1><Note>ตำแหน่ง POS · ความเร็ว WHEEL · PID รายล้อ WPID</Note></div>
      <ConnectionBadge $fresh={fresh}>{fresh ? "● POS LIVE" : state.connected ? "● POS STALE" : "● OFFLINE"}</ConnectionBadge>
      <StopButton onClick={() => void stop()}>■ STOP · X</StopButton></Header>
    <TunerLayout><TunerControls>
      <Panel><PanelHeading>เชื่อมต่อบอร์ดล้อ</PanelHeading><ActionButton disabled={busy || fresh} onClick={() => void connect()}>CONNECT / RECONNECT</ActionButton>
        <Note>/dev/lawengwanla-drive · UART 115200 · ปิด Mainprogram ก่อนเชื่อม</Note><Status role="status">{message}</Status>
        <Note>ข้อมูลสดยืนยันว่าได้รับ POS; ไม่มีข้อมูลสถานะมอเตอร์หรือ IMU ในเฟรมนี้</Note></Panel>
      <Panel><PanelHeading>ความเร็ว X/Y · S</PanelHeading><NumericField label="ความเร็วสูงสุด (m/s)" value={speed} onChange={setSpeed} />
        <SendButton disabled={!fresh || busy} onClick={() => void send("pos_speed", { speed })}>ส่ง S</SendButton>{latest("pos_speed")}
        <Note>ส่งแยกจาก G · ช่วงกรอกมากกว่า 0 ถึง 9999 · ramp ในบอร์ด {p.acceleration_mps2} m/s²</Note></Panel>
      <Panel><PanelHeading>Yaw PD · P5:max RPM:Kp:Kd</PanelHeading><Fields>
        <NumericField label="Max (RPM)" value={yawPid.max_rpm} onChange={max_rpm => setYawPid(old => ({ ...old, max_rpm }))} />
        <NumericField label="Kp" value={yawPid.kp} onChange={kp => setYawPid(old => ({ ...old, kp }))} />
        <NumericField label="Kd" value={yawPid.kd} onChange={kd => setYawPid(old => ({ ...old, kd }))} />
        </Fields><SendButton disabled={!fresh || busy} onClick={() => void send("yaw_pid", yawPid)}>ส่ง Yaw PD</SendButton>{latest("yaw_pid")}
        <Note>ทั้งสามค่ามากกว่า 0 ถึง 9999; firmware ไม่เปลี่ยนค่าเมื่อส่ง 0 · ไม่มี Ki</Note>
        <Note>ค่าคงที่ใน source: min {p.yaw_min_rpm} RPM · deadband {p.yaw_tolerance_rad} rad · ไม่มีคำสั่งปรับสองค่านี้</Note></Panel>
      {pidCard("PID ตำแหน่ง X", xPid, setXPid, "pos_pid_x")}{pidCard("PID ตำแหน่ง Y", yPid, setYPid, "pos_pid_y")}
      <Panel><PanelHeading>เป้าตำแหน่ง · G</PanelHeading><Fields>
        {(["x", "y", "yaw"] as const).map(key => <NumericField key={key} label={key === "yaw" ? "Yaw (rad)" : `${key.toUpperCase()} (m)`} value={goal[key]} onChange={v => setGoal(old => ({ ...old, [key]: v }))} />)}
        </Fields><Arm><input type="checkbox" checked={armed} disabled={!fresh || busy} onChange={e => setArmed(e.target.checked)} /> เปิดให้ส่งคำสั่งเคลื่อนที่ครั้งถัดไป</Arm>
        <SendButton disabled={!fresh || busy || !armed} onClick={() => void send("goal", goal)}>ส่ง G · ไปเป้า</SendButton>{latest("goal")}
        <Note>พิกัดสัมบูรณ์ · กดส่ง S/P5/P6/P7 เมื่อต้องการเปลี่ยนค่าก่อนวิ่ง</Note>
        <Note>{contract.goal_stop_policy
          ? "โค้ดรุ่นนี้หยุดเมื่อเข้า tolerance และนิ่งครบเวลา หรือเมื่อ timeout · ต้องแฟลชรุ่นนี้ลงบอร์ดจึงใช้งานได้ · ผลหยุดล่าสุดแสดงในช่อง UART"
          : "G คุมเป้าต่อจนส่ง X หรือคำสั่งใหม่"}</Note></Panel>
      <Panel><PanelHeading>Manual XY · V</PanelHeading><Fields>
        <NumericField label="Vx (m/s)" value={velocity.vx} onChange={vx => setVelocity(old => ({ ...old, vx }))} />
        <NumericField label="Vy (m/s)" value={velocity.vy} onChange={vy => setVelocity(old => ({ ...old, vy }))} />
        </Fields><SendButton disabled={!fresh || busy || !armed} onClick={() => void send("twist", velocity)}>ส่ง V · ความเร็วต่อเนื่อง</SendButton>{latest("twist")}
        <Note>ใช้ช่องเปิดคำสั่งด้านบน · จับ yaw ตอนเข้า manual · V ทำงานต่อจนส่ง X; firmware ไม่มี timeout เมื่อเว็บขาดการเชื่อมต่อ</Note></Panel>
      <Panel><PanelHeading>รีเซ็ต Odometry · Z</PanelHeading><ActionButton disabled={!fresh || busy} onClick={() => void send("pose_reset")}>หยุดและ Reset X/Y</ActionButton>{latest("pose_reset")}</Panel>
    </TunerControls><TunerReadout>
      <OriginalWheelTuning contract={contract} connected={fresh} fresh={!!(fresh && state.telemetry_fresh)}
        telemetry={state.wheel_telemetry} readback={state.wheel_pid_readback} rows={wheelRows}
        busy={busy} stopEpoch={stopEpoch} onSend={send} onStop={stop} />
      <Panel><PanelHeading>ODOMETRY · POS</PanelHeading><Readings>X {n(state.pose?.x)} m · Y {n(state.pose?.y)} m · Yaw {n(state.pose?.yaw)} rad</Readings>
        <Note>Tick X {state.pose?.tick_x ?? "—"} · Tick Y {state.pose?.tick_y ?? "—"}</Note>
        <Note>คำสั่งโหมดล่าสุดจากเว็บ: {state.requested_motion || "—"} · ไม่ใช่สถานะที่บอร์ดรายงาน</Note>
        <Map viewBox="0 0 320 320"><line x1="10" y1="160" x2="310" y2="160" stroke="#405675" /><line x1="160" y1="10" x2="160" y2="310" stroke="#405675" />
          <polyline points={rows.map(row => point(row.x, row.y)).join(" ")} fill="none" stroke="#58a6ff" strokeWidth="2" />
          {state.pose && <circle cx={160+state.pose.x*135/extent} cy={160-state.pose.y*135/extent} r="5" fill="#ff6b35" />}
          {state.pose && <line x1={160+state.pose.x*135/extent} y1={160-state.pose.y*135/extent}
            x2={160+state.pose.x*135/extent+Math.cos(state.pose.yaw)*22} y2={160-state.pose.y*135/extent-Math.sin(state.pose.yaw)*22} stroke="#ffffff" strokeWidth="3" />}
          {state.requested_goal && <circle cx={160+state.requested_goal.x*135/extent} cy={160-state.requested_goal.y*135/extent} r="7" fill="none" stroke="#ffdc7c" strokeWidth="2" />}
          <text x="268" y="150" fill="#bdc9e4">+X</text><text x="170" y="25" fill="#bdc9e4">+Y</text></Map>
        <Note>สีฟ้า: POS จริง · สีเหลือง: เป้าที่เว็บส่ง ไม่มี target readback · scale ±{extent.toFixed(2)} m</Note>
        <ActionButton onClick={() => setRows([])}>ล้างกราฟ</ActionButton></Panel>
      <Plot title="ตำแหน่ง X/Y" rows={rows} unit="m" lines={[{ key:"x", label:"X จริง",color:"#00d4aa" },{ key:"y",label:"Y จริง",color:"#58a6ff" },{key:"requested_x",label:"X ที่เว็บส่ง",color:"#ffffff",dashed:true},{key:"requested_y",label:"Y ที่เว็บส่ง",color:"#ffdc7c",dashed:true}]} />
      <Plot title="Yaw" rows={rows} unit="rad" lines={[{key:"yaw",label:"Yaw จริง",color:"#ff6b35"},{key:"requested_yaw",label:"Yaw ที่เว็บส่ง",color:"#ffffff",dashed:true}]} />
      <Plot title="Encoder odometry X/Y" rows={rows} unit="ticks" lines={[{key:"tick_x",label:"Tick X",color:"#00d4aa"},{key:"tick_y",label:"Tick Y",color:"#bc8cff"}]} />
      <Panel><PanelHeading>ขีดความสามารถเฟิร์มแวร์</PanelHeading><Note>PWM {contract.pwm_hz/1000} kHz · normalization {p.motor_max_rpm} RPM · ป้อนค่าได้ถึง 9999 แต่กำลังจริงยังเป็นไปตามบอร์ด</Note>
        <Note>{contract.wheel_pid_tuning ? "รองรับ PID รายล้อและ RPM/PWM จริง · ยังไม่มี Auto-tune อัตโนมัติ" : "ต้องแฟลชส่วนขยายก่อนใช้ PID รายล้อและ RPM/PWM"}</Note>
        <details><summary>คำสั่งที่รองรับและค่าเริ่มต้น</summary><Table><thead><tr><th>คำสั่ง</th><th>หน้าที่</th></tr></thead><tbody>{contract.commands.map(c => <tr key={c.command}><td><code>{c.command}</code></td><td>{c.function}</td></tr>)}</tbody></Table>
          <Note>ค่าเริ่มต้นอ่านจาก {contract.config_source} ไม่ใช่ค่า readback; แก้ฟอร์มได้ทุกค่าที่มีคำสั่งรองรับโดยไม่ส่งอัตโนมัติ</Note></details></Panel>
      <Panel><PanelHeading>UART</PanelHeading>
        {state.goal_status && <Status role="status">ล่าสุดที่บอร์ดรายงาน: {goalStatusText[state.goal_status.state] || state.goal_status.state}</Status>}
        <Code>{state.last_line || "รอข้อมูล…"}</Code><Code>{state.last_sent?.command || "ยังไม่มีคำสั่งจากหน้านี้"}</Code><Note>PID ล้อยืนยันด้วย WPID · คำสั่ง G/V/X/Z/S/P5–P7 ไม่มี ACK</Note></Panel>
    </TunerReadout></TunerLayout>
  </Page>;
}
const Fields = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;>label{display:block;>span{display:block;margin-bottom:6px;}}`;
const Header = styled(PageHeader)`justify-content:space-between;flex-wrap:wrap;margin-bottom:20px;>div:first-child{flex:1;min-width:210px;}h1{font-size:24px;line-height:1.35;margin:0 0 6px;color:#21336f;}p{color:#465478;margin-bottom:0;}>button{white-space:nowrap;flex-shrink:0;min-width:115px;}@media(max-width:650px){>div:first-child{flex-basis:100%;}h1{font-size:20px;}}`;
const Status = styled.p`color:#ffdc7c;line-height:1.7;overflow-wrap:anywhere;`;
const Chart = styled.div`height:260px;min-width:0;`;
const Readings = styled.p`font-size:20px;color:#ffdc7c;line-height:1.6;`;
const Arm = styled.label`display:block;margin:14px 0;color:#ffdc7c;`;
const Map = styled.svg`display:block;width:100%;max-width:440px;margin:auto;background:#0d1524;border-radius:12px;`;
const Table = styled.table`width:100%;border-collapse:collapse;font-size:12px;td,th{text-align:left;padding:10px;border-bottom:1px solid #354660;}td:first-child{white-space:nowrap;}@media(max-width:650px){td:first-child{white-space:normal;overflow-wrap:anywhere;}}`;
const Code = styled.pre`white-space:pre-wrap;overflow-wrap:anywhere;color:#b5e7d1;`;
