import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NumericField } from "./tuner/NumericField";
import { Panel, PanelHeading, Note, ActionButton, SendButton, StopButton } from "./tuner/RobotTuner.styles";
import { originalRequest, type OriginalAction, type OriginalContract, type Gains,
  type WheelTelemetry, type WheelSample, type WheelReadback } from "../utils/originalTuner";

const names = ["FL", "FR", "RL", "RR"];
const colors = ["#00d4aa", "#58a6ff", "#ff6b35", "#bc8cff"];
const number = (value?: number, digits = 2) => Number.isFinite(value) ? value!.toFixed(digits) : "—";
type Props = { contract: OriginalContract; connected: boolean; fresh: boolean; telemetry?: WheelTelemetry;
  readback?: WheelReadback; rows: WheelSample[]; busy: boolean; stopEpoch: number;
  onSend: (action: OriginalAction, values?: Record<string, unknown>) => Promise<boolean>;
  onStop: () => Promise<void> };

export default function OriginalWheelTuning(props: Props) {
  const { contract, connected, fresh, telemetry, readback, rows, busy, onSend, onStop, stopEpoch } = props;
  const [mask, setMask] = useState(1), [rpm, setRpm] = useState(30), [unlocked, setUnlocked] = useState(false);
  const [running, setRunning] = useState(false), [message, setMessage] = useState("");
  const lease = useRef(0), timer = useRef<ReturnType<typeof setTimeout>>(), startedAt = useRef(0);
  const sender = useRef(onSend); sender.current = onSend;
  const ready = !!(connected && fresh && telemetry?.version === 1);
  const stopped = ready && !telemetry!.enabled && telemetry!.pwm.every(v => Math.abs(v) < .1) && telemetry!.rpm.every(v => Math.abs(v) < 5);
  const cancel = () => { lease.current++; clearTimeout(timer.current); setRunning(false); setUnlocked(false); };
  useEffect(() => { cancel(); }, [stopEpoch]);
  useEffect(() => () => { lease.current++; clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!ready) setUnlocked(false);
    if (running && (!ready || !telemetry?.imu_fresh ||
        (!telemetry?.enabled && Date.now() - startedAt.current > 500))) {
      cancel(); void onStop();
    }
  }, [ready, telemetry?.imu_fresh, telemetry?.enabled, running]);
  const start = async () => {
    if (!stopped || !unlocked || busy || !telemetry?.imu_fresh) return;
    try { originalRequest("wheel_rpm", { mask, rpm }); }
    catch (error) { setMessage((error as Error).message); return; }
    const token = ++lease.current, values = { mask, rpm };
    setUnlocked(false); setRunning(true); startedAt.current = Date.now(); setMessage("");
    const tick = async () => {
      if (lease.current !== token) return;
      const ok = await sender.current("wheel_rpm", values);
      if (lease.current !== token) return;
      if (!ok) { cancel(); return; }
      timer.current = setTimeout(() => void tick(), 200);
    };
    await tick();
  };
  const plot = rows.map(row => ({ t: row.t, ...Object.fromEntries(names.flatMap((name, i) =>
    [[name, row.rpm[i]], [name + "Target", row.target_rpm_each[i]]])) }));
  return <>
    <Panel><PanelHeading>ความเร็วล้อ · RPM จริง / เป้า</PanelHeading>
      <Note>{ready ? "WHEEL LIVE · ข้อมูลจาก STM32 10 Hz" : "รอ WHEEL จากเฟิร์มแวร์ใหม่ · ยังไม่มีข้อมูลความเร็วล้อ"}</Note>
      <Cards>{names.map((name, i) => <Reading key={name} $color={colors[i]}>
        <b>{name}</b><strong>{ready ? number(telemetry?.rpm[i]) : "—"} RPM</strong>
        <span>เป้า {ready ? number(telemetry?.target_rpm_each[i]) : "—"} RPM</span>
        <span>PWM {ready ? number(telemetry?.pwm[i], 0) : "—"} · Tick {ready ? telemetry?.ticks[i] : "—"}</span>
      </Reading>)}</Cards>
      <Graph><ResponsiveContainer width="100%" height="100%"><LineChart data={plot}>
        <CartesianGrid stroke="#253754" strokeDasharray="3 3" /><XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} stroke="#9db0ce" />
        <YAxis unit=" RPM" stroke="#9db0ce" /><Tooltip labelFormatter={v => `MCU ${Number(v).toFixed(2)} s`} />
        {names.flatMap((name, i) => [<Line key={name} dataKey={name} name={`${name} จริง`} stroke={colors[i]} dot={false} isAnimationActive={false} />,
          <Line key={name+"Target"} dataKey={name+"Target"} name={`${name} เป้า`} stroke={colors[i]} strokeDasharray="5 4" dot={false} isAnimationActive={false} />])}
      </LineChart></ResponsiveContainer></Graph>
      <Note>เส้นทึบ: RPM encoder หลัง Kalman ในบอร์ด · เส้นประ: เป้า RPM จากบอร์ด · ข้อมูลค้างแสดง —</Note>
      <Note>{ready ? `${telemetry?.enabled ? "กำลังควบคุมมอเตอร์" : "คำสั่งมอเตอร์หยุด"} · IMU ${telemetry?.imu_fresh ? "สด" : "ไม่สด: บอร์ดจะหยุดมอเตอร์"}` : "ยังไม่สามารถยืนยันสถานะมอเตอร์ได้"}</Note>
    </Panel>
    <Panel><PanelHeading>จูน PID แยกล้อ</PanelHeading>
      <Note>Kp / Ki / Kd ช่วง 0–9999 · ส่งเมื่อหยุด · บันทึกใน RAM รีเซ็ตบอร์ดแล้วกลับค่าเริ่มต้น</Note>
      <Cards>{names.map(name => <WheelPid key={name} name={name} initial={contract.wheel_defaults?.[name]}
        current={readback?.[name]} enabled={stopped && !busy && !running} onSend={onSend} />)}</Cards>
      <ActionButton disabled={!ready || busy || running} onClick={() => void onSend("wheel_info")}>อ่าน PID จากบอร์ด · Q</ActionButton>
      <Note>ค่าที่อ่านกลับมาจาก WPID จริง · ต้องแฟลชเฟิร์มแวร์ใหม่ก่อน ปุ่มจึงจะเปิดใช้งาน</Note>
    </Panel>
    <Panel><PanelHeading>ทดสอบความเร็วแยกล้อ</PanelHeading>
      <Choices>{[1, 2, 4, 8, 15].map((value, i) => <ActionButton key={value} aria-pressed={mask === value}
        disabled={running || busy} onClick={() => { setMask(value); setUnlocked(false); }}>{names[i] || "ALL"}</ActionButton>)}</Choices>
      <NumericField label="RPM ทดสอบ (-300 ถึง 300)" value={rpm} onChange={v => { setRpm(v); setUnlocked(false); }} />
      <Arm><input type="checkbox" checked={unlocked} disabled={!stopped || busy || running || !telemetry?.imu_fresh}
        onChange={e => setUnlocked(e.target.checked)} /> เปิดทดสอบล้อที่เลือก</Arm>
      <SendButton disabled={!stopped || !unlocked || busy || running || !telemetry?.imu_fresh} onClick={() => void start()}>เริ่มทดสอบ RPM</SendButton>
      <StopButton onClick={() => { cancel(); void onStop(); }}>หยุดทดสอบล้อ</StopButton>
      <Note>{running ? "กำลังทดสอบ · ใช้ RPM ตอนกดเริ่ม" : "ยังไม่เริ่มทดสอบ"} · ส่งต่อทุก 200 ms; บอร์ดหยุดเมื่อขาดคำสั่ง {contract.wheel_run_timeout_ms ?? 700} ms</Note>
      <Note>RPM ทดสอบจำกัดตามความสามารถบอร์ด 300 RPM · เงื่อนไขหยุดจาก IMU ยังคงทำงาน</Note>
      {message && <Note role="alert">{message}</Note>}
    </Panel>
  </>;
}

function WheelPid({ name, initial, current, enabled, onSend }: { name: string; initial?: Gains;
  current?: WheelReadback[string]; enabled: boolean; onSend: Props["onSend"] }) {
  const [gains, setGains] = useState<Gains>(initial || { kp: NaN, ki: NaN, kd: NaN });
  const dirty = useRef(false), initialized = useRef(false);
  useEffect(() => {
    if (current && !initialized.current) {
      initialized.current = true;
      if (!dirty.current) setGains({ ...current.gains });
    }
  }, [current]);
  return <PidCard><h3>PID ล้อ {name}</h3>
    {(["kp", "ki", "kd"] as const).map(key => <NumericField key={key} label={`${name} ${key.toUpperCase()}`} value={gains[key]}
      onChange={v => { dirty.current = true; setGains(old => ({ ...old, [key]: v })); }} />)}
    <SendButton disabled={!enabled} onClick={() => void onSend("wheel_pid", { wheel: name, ...gains })}>ส่ง PID {name}</SendButton>
    <Note>บอร์ดอ่านกลับ: {current ? `${current.gains.kp} / ${current.gains.ki} / ${current.gains.kd}` : "—"}</Note>
    <ActionButton disabled={!current} onClick={() => { if (current) { dirty.current = false; setGains({ ...current.gains }); } }}>ใช้ค่าบอร์ด {name}</ActionButton>
  </PidCard>;
}
const Cards = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0;@media(max-width:600px){grid-template-columns:minmax(0,1fr);}`;
const Reading = styled.div<{$color: string}>`border:1px solid ${p=>p.$color};padding:14px;border-radius:10px;display:grid;gap:8px;color:#c8d7ed;strong{font-size:23px;color:${p=>p.$color};}span{font-size:13px;}`;
const PidCard = styled.div`border:1px solid #354660;border-radius:10px;padding:14px;min-width:0;h3{color:#ffdc7c;margin:0 0 12px;}`;
const Graph = styled.div`height:290px;min-width:0;`;
const Choices = styled.div`display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;button[aria-pressed=true]{outline:2px solid #00d4aa;}`;
const Arm = styled.label`display:block;margin:14px 0;color:#ffdc7c;`;
