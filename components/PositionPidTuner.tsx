import { useEffect, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import type { Stm32Contract } from "../utils/stm32Contract";
import type { PositionSpeeds } from "./PositionSpeedFields";
import {
  POSITION_PID_FIRMWARE, PositionPidAction, PositionPidConfirmation,
  PositionPidProfile, sendPositionPid, validPositionPidProfile,
} from "../utils/positionPid";
import { NumericField } from "./tuner/NumericField";
import PositionAutoTune from "./PositionAutoTune";
import { Panel, PanelHeading, Note, ActionButton, SendButton } from "./tuner/RobotTuner.styles";

type Props = {
  contract: Stm32Contract | null;
  speeds: PositionSpeeds;
  onSpeedsChange: (value: PositionSpeeds) => void;
  connected: boolean;
  fresh: boolean;
  stopped: boolean;
  firmware?: string;
  applied?: Partial<Record<PositionPidAction, PositionPidConfirmation>>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  request: (path: string, body?: Record<string, unknown>) => Promise<any>;
  onMessage: (value: string) => void;
};
const axes = [
  { key: "x" as const, label: "PID X", action: "pos_pid_x" as const },
  { key: "y" as const, label: "PID Y", action: "pos_pid_y" as const },
  { key: "yaw" as const, label: "Yaw PD", action: "yaw_pid" as const },
];

export default function PositionPidTuner(props: Props) {
  const [draft, setDraft] = useState<PositionPidProfile | null>(null);
  const [profiles, setProfiles] = useState<PositionPidProfile[]>([]);
  const [pending, setPending] = useState(false);
  const [autoActive, setAutoActive] = useState(false);
  useEffect(() => { props.onBusyChange(pending || autoActive); }, [pending, autoActive]);
  const [message, setMessage] = useState("");
  const defaults = () => {
    const p = props.contract?.position;
    return p ? { id: "", ...props.speeds, x: { ...p.x }, y: { ...p.y }, yaw: { kp: p.yaw_kp, kd: p.yaw_kd } } : null;
  };
  useEffect(() => {
    if (!draft && props.contract?.position) setDraft(defaults());
  }, [props.contract]);
  useEffect(() => {
    let disposed = false;
    props.request("/api/tuner/position-pid-profiles")
      .then(data => { if (!disposed) setProfiles((data.profiles ?? []).filter(validPositionPidProfile)); })
      .catch(error => { if (!disposed) setMessage(`โหลดโปรไฟล์ไม่ได้: ${error.message}`); });
    return () => { disposed = true; };
  }, []);
  const profile = draft ? { ...draft, ...props.speeds } : null;
  const valid = validPositionPidProfile(profile);
  const supported = props.firmware === POSITION_PID_FIRMWARE;
  const canSend = valid && props.connected && props.fresh && supported && props.stopped && !props.busy && !pending && !autoActive;
  const update = (axis: "x" | "y" | "yaw", key: "kp" | "ki" | "kd", value: number) => {
    setDraft(old => old ? { ...old, [axis]: { ...old[axis], [key]: value } } : old);
  };
  const apply = async (actions: PositionPidAction[]) => {
    if (!canSend || !profile) return;
    setPending(true); setMessage("");
    try {
      const results = await sendPositionPid(props.request, profile, actions);
      const text = results.map(result => `${result.command} → ${result.ack}`).join(" · ");
      setMessage(`บอร์ดยืนยันแล้ว: ${text}`); props.onMessage(`ส่ง PID สำเร็จ · ${text}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "ส่ง PID ไม่สำเร็จ";
      const failure = actions.length > 1 ? `ส่งไม่ครบ · ตรวจค่าที่บอร์ดยืนยันแต่ละแกน · ${text}` : text;
      setMessage(failure); props.onMessage(failure);
    } finally { setPending(false); }
  };
  const save = async () => {
    if (!profile || !valid || pending) return;
    setPending(true);
    try {
      const data = await props.request("/api/tuner/position-pid-profiles", profile);
      setProfiles(data.profiles); setMessage("บันทึกโปรไฟล์ตามสปีดแล้ว · กดส่ง PID เพื่อใช้บนบอร์ด");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่ได้"); }
    finally { setPending(false); }
  };
  const selected = profiles.find(p => p.linear_mps === props.speeds.linear_mps && p.angular_radps === props.speeds.angular_radps);
  return <Panel aria-label="จูน PID ตำแหน่ง X Y Yaw">
    <PanelHeading>ตั้งค่า PID X / Y / YAW · ส่งไปบอร์ดล้อ STM32</PanelHeading>
    <Note>สปีดที่กำลังจูน: {props.speeds.linear_mps} m/s · {props.speeds.angular_radps} rad/s</Note>
    <ProfileControls>
      <label>โปรไฟล์ตามสปีด
        <select aria-label="เลือกโปรไฟล์ PID ตามสปีด" value={selected?.id ?? ""} disabled={pending || props.busy}
          onChange={event => {
            const next = profiles.find(p => p.id === event.target.value);
            if (next) { setDraft(next); props.onSpeedsChange({ linear_mps: next.linear_mps, angular_radps: next.angular_radps }); setMessage("โหลดค่าในฟอร์มแล้ว · ยังไม่ได้ส่งไปบอร์ด"); }
          }}>
          <option value="">{profiles.length ? "เลือกโปรไฟล์ที่บันทึกไว้" : "ยังไม่มีโปรไฟล์ที่บันทึก"}</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.linear_mps} m/s · {p.angular_radps} rad/s</option>)}
        </select>
      </label>
      <ActionButton disabled={pending || props.busy || !props.contract?.position} onClick={() => { setDraft(defaults()); setMessage("โหลดค่าเริ่มต้นจากไฟล์เฟิร์มแวร์ · ยังไม่ได้ส่งไปบอร์ด"); }}>โหลดค่าเริ่มต้น v27</ActionButton>
    </ProfileControls>
    {!profile ? <Note>กำลังอ่านค่าเริ่มต้น PID…</Note> : <PidGrid>
      {axes.map(axis => {
        const gains = profile[axis.key]; const confirmed = props.applied?.[axis.action];
        return <AxisCard key={axis.key}>
          <h3>{axis.label}</h3>
          <PidFields>
          <NumericField label="Kp" value={gains.kp} onChange={value => update(axis.key, "kp", value)} />
          {axis.key === "yaw" ? <FixedValue>Ki <strong>0</strong> · v27 ใช้ PD</FixedValue> :
            <NumericField label="Ki" value={profile[axis.key].ki} onChange={value => update(axis.key, "ki", value)} />}
          <NumericField label="Kd" value={gains.kd} onChange={value => update(axis.key, "kd", value)} />
          </PidFields>
          <SendButton disabled={!canSend} onClick={() => void apply([axis.action])}>ส่ง {axis.label} ไปบอร์ด</SendButton>
          <Confirmation data-testid={`pid-confirmation-${axis.key}`}>
            {confirmed ? <>ล่าสุดที่บอร์ดยืนยัน: Kp {confirmed.gains.kp}{confirmed.gains.ki !== undefined ? ` · Ki ${confirmed.gains.ki}` : ""} · Kd {confirmed.gains.kd}<br />{confirmed.ack}</> : "ยังไม่มีค่าที่บอร์ดยืนยันในการเชื่อมต่อครั้งนี้"}
          </Confirmation>
        </AxisCard>;
      })}
    </PidGrid>}
    <Buttons>
      <SendButton disabled={!canSend} onClick={() => void apply(axes.map(axis => axis.action))}>{pending ? "กำลังดำเนินการ…" : "ส่ง PID X / Y / Yaw ทั้งหมด"}</SendButton>
      <ActionButton disabled={!valid || pending || props.busy} onClick={() => void save()}>บันทึกโปรไฟล์ตามสปีดนี้</ActionButton>
    </Buttons>
    {!props.connected ? <Note>เชื่อมต่อ STM32 เพื่อส่งค่า · ปิด Mainprogram ในหน้า Service ก่อนใช้ Tuner</Note> :
      !props.fresh ? <Note role="alert">ข้อมูลบอร์ดค้าง · ยังส่ง PID ไม่ได้ กรุณาตรวจบอร์ดและเชื่อมต่อใหม่</Note> :
      !supported ? <Note>เฟิร์มแวร์ {props.firmware || "กำลังอ่าน…"} · การส่ง PID ตำแหน่งต้องใช้ v27-tuning</Note> :
      !props.stopped ? <Note>กด STOP และรอให้ล้อหยุดก่อนส่ง PID</Note> : null}
    {profile && !valid && <Note role="alert">PID ต้องเป็นตัวเลข 0–9999 และกรอกความเร็วให้ถูกต้อง</Note>}
    <Note>ส่งค่าเมื่อกดปุ่มเท่านั้น · เปลี่ยนค่าชั่วคราวในบอร์ดจนรีเซ็ต · บันทึกโปรไฟล์เก็บไว้บนเครื่องหุ่นโดยไม่ส่งคำสั่งวิ่ง</Note>
    <Note>PID ความเร็วล้อ FL/FR/RL/RR อยู่ที่ <Link href="/WheelTuner">Wheel Tuner</Link></Note>
    {message && <Confirmation role="status">{message}</Confirmation>}
    <PositionAutoTune ready={props.connected && props.fresh && supported && props.stopped}
      busy={props.busy || pending} request={props.request}
      onActive={setAutoActive}
      onSuggestion={(axis, gains, speeds) => {
        setDraft(old => old ? { ...old, [axis]: { ...gains } } : old);
        props.onSpeedsChange({ linear_mps: speeds.linear_mps, angular_radps: speeds.angular_radps });
      }} />
  </Panel>;
}

const PidGrid = styled.div`display:grid;gap:12px;margin:16px 0;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));`;
const AxisCard = styled.div`min-width:0;padding:14px;border:1px solid #455987;border-radius:10px;background:#111b32;h3{color:#ffdc7c;margin:0 0 12px;font-size:16px;}button{width:100%;}`;
const FixedValue = styled.div`min-height:42px;margin-bottom:12px;color:#bdc9e4;font-size:12px;display:flex;align-items:center;gap:12px;strong{color:#ffdc7c;}`;
const PidFields = styled.div`display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;>label{grid-template-columns:minmax(0,1fr);gap:5px;margin-bottom:0;}input{min-width:0;}`;
const Confirmation = styled.p`color:#b5e7d1;font-size:12px;line-height:1.7;overflow-wrap:anywhere;margin:12px 0 0;`;
const ProfileControls = styled.div`display:flex;align-items:end;gap:10px;flex-wrap:wrap;label{display:grid;gap:7px;color:#bdc9e4;font-size:12px;}select{min-width:210px;}`;
const Buttons = styled.div`display:flex;gap:10px;flex-wrap:wrap;`;
