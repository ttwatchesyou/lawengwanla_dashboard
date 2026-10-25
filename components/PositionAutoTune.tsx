import { subscribeJson } from "../utils/readPolling";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AxisPidGains } from "../utils/positionPid";
import { ActionButton, Note, StopButton } from "./tuner/RobotTuner.styles";
import { NumericField } from "./tuner/NumericField";

type Axis = "x" | "y" | "yaw";
type Result = { gains: AxisPidGains; score: number; steps: { overshoot: number; settling_seconds: number }[] };
type Status = {
  id?: string; active?: boolean; status: string; candidate?: number;
  config?: { axis: Axis; linear_mps: number; angular_radps: number };
  results?: Result[]; recommendation?: Result; error?: string; restored?: boolean;
  recording?: string; recording_error?: string;
  points?: { trial: string; t: number; target: number; value: number }[];
};
type Props = {
  ready: boolean; busy: boolean;
  request: (path: string, body?: Record<string, unknown>) => Promise<any>;
  onActive: (value: boolean) => void;
  onSuggestion: (axis: Axis, gains: AxisPidGains, speeds: { linear_mps: number; angular_radps: number }) => void;
};

export default function PositionAutoTune(props: Props) {
  const [axis, setAxis] = useState<Axis>("x");
  const [amplitude, setAmplitude] = useState(.1);
  const [linear, setLinear] = useState(.15);
  const [angular, setAngular] = useState(.3);
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>({ status: "idle" });
  const [message, setMessage] = useState("");
  const owner = useRef<string | null>(null);
  const callbacks = useRef(props); callbacks.current = props;
  useEffect(() => {
    // Read visibility must not suspend the owner's command heartbeat.
    const heartbeat=window.setInterval(()=>{
      if(owner.current) void callbacks.current.request("/api/tuner/autotune",{action:"heartbeat",id:owner.current}).catch(()=>{});
    },1000);
    const unsubscribe=subscribeJson<Status>(`${process.env.NEXT_PUBLIC_ROBOT_API ?? ""}/api/tuner/autotune`,next=>{
      if(owner.current && next.id!==owner.current)return;
      setStatus(next);callbacks.current.onActive(!!next.active);
      if(!next.active)owner.current=null;
    },error=>setMessage(`อ่านสถานะไม่ได้: ${error.message}`),1000);
    return ()=>{
      unsubscribe();window.clearInterval(heartbeat);
      if(owner.current)void callbacks.current.request("/api/tuner/autotune",{action:"cancel"}).catch(()=>{});
    };
  }, []);
  useEffect(() => { if (!props.ready || status.active) setArmed(false); }, [props.ready, status.active]);
  const valid = Number.isFinite(amplitude) && amplitude >= .05 && amplitude <= (axis === "yaw" ? .25 : .2) &&
    Number.isFinite(linear) && linear >= .05 && linear <= .3 && Number.isFinite(angular) && angular >= .1 && angular <= .5;
  const start = async () => {
    if (!armed || !valid || !props.ready || props.busy || pending || status.active) return;
    setPending(true); setArmed(false); props.onActive(true); setMessage("");
    try {
      const next = await props.request("/api/tuner/autotune", { action: "start", axis, amplitude, linear_mps: linear, angular_radps: angular });
      owner.current = next.id; setStatus({ ...next, active: true });
    } catch (error) { props.onActive(false); setMessage((error as Error).message); }
    finally { setPending(false); }
  };
  const cancel = async () => {
    setPending(true);
    try {
      await props.request("/api/tuner/autotune", { action: "cancel" });
      await props.request("/api/tuner/command", { action: "stop" });
      setMessage("ส่ง STOP แล้ว · รอยืนยันล้อหยุดและคืน PID เดิม");
    } catch (error) { setMessage(`STOP ไม่สำเร็จ: ${(error as Error).message} · ใช้หยุดฉุกเฉิน`); }
    finally { setPending(false); }
  };
  const latestTrial = status.points?.[status.points.length - 1]?.trial;
  const graph = status.points?.filter(p => p.trial === latestTrial) ?? [];
  return <section aria-label="Auto-tune PID ตำแหน่ง" style={{ borderTop: "1px solid #455987", marginTop: 20, paddingTop: 16 }}>
    <h3>Auto-tune X / Y / Yaw · ทดลอง P/D</h3>
    <Note>ทดลองรอบจุดเริ่ม +ระยะ → −ระยะ → กลับจุดเริ่ม เปรียบเทียบสูงสุด 5 ชุด · Ki คงเดิม · คำนวณบนเครื่องหุ่น</Note>
    <Note>ใช้สปีดทดลองต่ำเพื่อหาค่าเริ่มต้น ไม่ใช่การรับรองผลที่ทุกสปีด · จบแล้วคืน PID เดิม และให้เลือกโหลดค่าที่แนะนำเอง</Note>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <label>แกน <select aria-label="แกน Auto-tune" value={axis} disabled={pending || status.active} onChange={e => { setAxis(e.target.value as Axis); setArmed(false); }}>
        <option value="x">X</option><option value="y">Y</option><option value="yaw">Yaw</option>
      </select></label>
      <NumericField label={axis === "yaw" ? "ขยับ ±rad (0.05–0.25)" : "ขยับ ±m (0.05–0.20)"} value={amplitude} onChange={v => { setAmplitude(v); setArmed(false); }} />
      <NumericField label="สปีดทดลอง m/s (0.05–0.30)" value={linear} onChange={v => { setLinear(v); setArmed(false); }} />
      <NumericField label="สปีดหมุน rad/s (0.10–0.50)" value={angular} onChange={v => { setAngular(v); setArmed(false); }} />
    </div>
    <Note>ต้องส่ง PID ทั้งสามแกนให้บอร์ดยืนยันก่อนเริ่ม · ต้องมีพื้นที่ว่างทั้งสองทิศ · ปิดหน้าหรือขาดการติดต่อเกิน 5 วินาที ระบบจะส่ง STOP</Note>
    <label style={{ display: "block", margin: "12px 0" }}><input type="checkbox" checked={armed} disabled={!props.ready || props.busy || pending || status.active} onChange={e => setArmed(e.target.checked)} /> พร้อมให้หุ่นขยับทดลองตามระยะที่ตั้ง</label>
    <ActionButton disabled={!armed || !valid || !props.ready || props.busy || pending || status.active} onClick={() => void start()}>เริ่ม Auto-tune {axis.toUpperCase()}</ActionButton>{" "}
    <StopButton disabled={!status.active} onClick={() => void cancel()}>STOP / ยกเลิก Auto-tune</StopButton>
    <Note role="status">สถานะ: {status.status}{status.candidate ? ` · ชุดที่ ${status.candidate}/5` : ""}{status.restored ? " · บอร์ดยืนยันคืน PID เดิมแล้ว" : ""}</Note>
    {status.status === "complete" && !status.recommendation && <Note>ข้อมูลช่วงทดลองไม่ครบพอสำหรับเทียบกับค่าเดิม · ยังไม่มีค่า PID ที่แนะนำ</Note>}
    {status.error && <Note role="alert">{status.error}</Note>}
    {status.results?.map((r, i) => <Note key={i}>ชุด {i + 1}: Kp {r.gains.kp.toFixed(3)} · Ki {(r.gains.ki ?? 0).toFixed(3)} · Kd {r.gains.kd.toFixed(3)} · คะแนน {r.score.toFixed(3)} (ต่ำดีกว่า) · เลยเป้าสูงสุด {Math.max(...r.steps.map(s => s.overshoot)).toFixed(4)} {status.config?.axis === "yaw" ? "rad" : "m"}</Note>)}
    {status.recommendation && status.config && <ActionButton disabled={props.busy || !!status.active || !props.ready} onClick={() => {
      props.onSuggestion(status.config!.axis, status.recommendation!.gains, status.config!);
      setMessage("โหลดค่าที่แนะนำและสปีดทดลองลงฟอร์มแล้ว · กดส่ง PID เพื่อใช้ และบันทึกโปรไฟล์เมื่อตรวจผลแล้ว");
    }}>โหลดค่าที่แนะนำลงฟอร์ม</ActionButton>}
    {graph.length > 0 && <div style={{ height: 210, marginTop: 12 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={graph}>
      <CartesianGrid stroke="#334155" /><XAxis dataKey="t" type="number" unit="s" /><YAxis domain={["auto", "auto"]} /><Tooltip />
      <Line dataKey="target" name="Setpoint" stroke="#ffdc7c" dot={false} isAnimationActive={false} />
      <Line dataKey="value" name="ค่าจริง" stroke="#00d4aa" dot={false} isAnimationActive={false} />
    </LineChart></ResponsiveContainer><Note>กราฟช่วงสุดท้าย · บันทึกครบทุกชุดไว้บนเครื่องหุ่น</Note></div>}
    {status.recording && <Note>บันทึก: {status.recording}</Note>}
    {status.recording_error && <Note role="alert">บันทึกไม่สำเร็จ: {status.recording_error}</Note>}
    {message && <Note role="status">{message}</Note>}
  </section>;
}
