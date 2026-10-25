import useStm32Contract from "../utils/useStm32Contract";
import Stm32PositionPolicy from "./Stm32PositionPolicy";
import { useEffect, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { LiveOdometry } from "../utils/useLiveOdometry";
import { ExecutionSettings } from "../utils/mainprogramSettings";

export default function MainprogramPanel({settings, onChange, onReady, distanceM, live}: {live: LiveOdometry; distanceM: number; settings: ExecutionSettings; onChange: (s: ExecutionSettings) => void; onReady: (ready: boolean) => void}) {
  const {state}=live;
  const {contract,error:contractError}=useStm32Contract();
  const [message,setMessage] = useState("");
  useEffect(() => {onReady(!!state.ready && live.fresh && !["RUN","STOPPING"].includes(state.status));},[state.ready,state.status,live.fresh,onReady]);
  const anchor=async () => {
    try {
      const response=await fetch("/api/mainprogram/anchor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({execution_settings:settings})});
      if (!response.ok) throw Error("ตั้งจุดอ้างอิงไม่ได้ · ต้องมี odometry สดและหุ่นหยุดก่อน");
      setMessage("ส่งคำขอตั้งจุดอ้างอิงจากพิกัดจริงแล้ว · ไม่สั่งมอเตอร์");
    } catch(e) {setMessage(e instanceof Error?e.message:"ตั้งจุดอ้างอิงไม่สำเร็จ");}
  };
  const numberField=(key: "cell_m" | "outside_clearance_m" | "exit_clearance_m", label: string) => <label>{label}<input data-testid={`execution-${key}`} type="number" min={key==="cell_m"?.05:0} max="2" step="0.001" value={settings[key]} onChange={event => onChange({...settings,[key]:Number(event.target.value)})}/></label>;
  const stop=async () => {
    try {const response=await fetch("/api/mainprogram/stop",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if (!response.ok) throw Error("ส่งคำสั่งหยุดไม่สำเร็จ");setMessage("ส่งคำสั่งหยุดแล้ว · รอการยืนยันจากบอร์ด");}
    catch {setMessage("ส่งคำสั่งหยุดไม่ได้ · ตรวจการเชื่อมต่อ");}
  };
  const busy=["RUN","STOPPING"].includes(state.status);
  const holding=state.position_holding===true;
  const original=state.wheel_protocol==="original";
  return <Panel id="mainprogram-control" aria-label="ควบคุมการวิ่งสนามจริง">
    <header><h2>วิ่งสนามจริงผ่าน ROS</h2><strong data-testid="mainprogram-run-status">{state.status}</strong></header>
    <p data-testid="mainprogram-reason">{state.detail || state.reason} · <Link href="/Service">เปิด–ปิด Mainprogram ที่หน้า Service</Link></p>
    {original && <p>พอร์ตล้อ {state.wheel_port} · POS/WHEEL สดตามบอร์ด · Mainprogram เก็บเส้นทางและตรวจการถึงจุดจากพิกัดจริง · ใช้ G/S/P5/X</p>}
    {original && <p>START ส่งแผนทั้งหมดให้ Mainprogram ครั้งเดียว · ช่องแนวตรงต่อกันใช้เป้าปลายช่วงเดียว วิ่งผ่านช่องกลางโดยไม่หยุดรอ · เปลี่ยนเป้าที่มุมด้วยความเร็วต่ำ และหยุดที่ปลายทางหรือช่องที่เลือกหยุด</p>}
    <fieldset disabled={busy}><legend>ระยะและจุดเริ่มจริง</legend><Fields>
      {numberField("cell_m","ระยะต่อช่อง (เมตร)")}
      <label>ตำแหน่งหุ่นก่อนกด START<select data-testid="execution-start-mode" value={settings.start_mode} onChange={event => onChange({...settings,start_mode:event.target.value as ExecutionSettings["start_mode"]})}><option value="at_entry">กลางช่อง A8</option><option value="outside_a6">นอกสนามด้านซ้าย A6</option></select></label>
      {numberField("outside_clearance_m","ระยะศูนย์กลางหุ่นถึงขอบสนามด้านซ้าย (เมตร)")}
      {numberField("exit_clearance_m","ระยะศูนย์กลางหุ่นพ้นขอบขวาตอนจบ (0 = หยุดกลาง H)")}
    </Fields></fieldset>
    {settings.start_mode==="outside_a6" && <p>ช่วงแรกก่อนเข้าสนามใช้เป้าระยะเดียวกับตัวทดลอง A6 → A8: 2.000 เมตร แล้วเคลื่อนเข้ากลางช่อง A8 โดยบอร์ดควบคุมความเร็วและการเข้าตำแหน่ง</p>}
    {settings.start_mode==="outside_a6" && <p>{original ? "Mainprogram ส่งเป้าทีละช่วงตามตำแหน่งวัดจริง · บอร์ดควบคุม PID แต่ละช่วง" : "บอร์ดรับพิกัดเป้าหมายทั้งหมดก่อนเริ่ม แล้วไล่เป้าหมายจากตำแหน่งที่เซนเซอร์วัดได้ด้วยตัวเอง"}</p>}
    <p>หัวหุ่นเริ่มชี้ขึ้นสนามและคงทิศเดิม · ใช้พิกัดเส้นทางที่เลือกด้านบน · ตั้งสปีดวิ่ง/หมุนรายจุดได้ บอร์ดคุม PID และการเข้าตำแหน่งเอง · START จะสั่งล้อจริง</p>
    <Stm32PositionPolicy contract={contract} error={contractError}/>
    <p data-testid="mainprogram-planned-distance">ระยะวิ่งตามแผน {distanceM.toFixed(3)} เมตร</p>
    <p>ถึงช่อง {state.highest_reached ?? 0} / 37{state.target ? ` · เป้าหมาย ${state.target.label}` : ""}{state.distance_m ? ` · ระยะรวม ${state.distance_m.toFixed(3)} ม.` : ""}{state.pose ? ` · พิกัดบอร์ด X ${state.pose[0].toFixed(3)} Y ${state.pose[1].toFixed(3)} · หัว ${(state.pose[2]*180/Math.PI).toFixed(1)}°` : ""}</p>
    <button type="button" data-testid="mainprogram-anchor" onClick={anchor} disabled={busy || !live.fresh}>ตั้งจุดอ้างอิงสนามจากตำแหน่งหุ่นตอนนี้</button>
    <p>หัวหุ่น 0° คือทิศตอนเปิดบอร์ด · เดินหน้า ถอยหลัง และสไลด์ใช้มุมเป้าหมายเดิม</p>
    <p>เว็บใช้ตำแหน่งเริ่มที่เลือกกับค่า encoder แรกโดยอัตโนมัติ · START ใช้พิกัดปัจจุบันของบอร์ดคำนวณเป้าหมาย · ปุ่มตั้งอ้างอิงใช้เมื่อต้องการวางหุ่นกลับจุดเริ่มใหม่เท่านั้น ไม่ขยับมอเตอร์</p>
    <button type="button" data-testid="mainprogram-stop" onClick={stop} disabled={!busy && !holding}>{holding?"หยุดและปลดล็อกตำแหน่ง":"หยุดวิ่งสนาม"}</button>
    {holding && <p>บอร์ดกำลังรักษาตำแหน่งและมุมเริ่มต้น · กดหยุดเพื่อปลดล็อก หรือ START เพื่อวิ่งตามแผน</p>}
    <small>ส่วนนี้ควบคุมการวิ่งสนาม งานหยิบ–วางบล็อกและแผ่นเหล็กยังไม่ถูกสั่งทำ</small>
    {message && <p role="status">{message}</p>}
  </Panel>;
}
const Panel=styled.section`
 margin:20px 0;padding:20px;border:1px solid #8da8c9;border-radius:16px;background:#f3f8ff;color:#1e3271;
 header{display:flex;justify-content:space-between;gap:12px;align-items:center}h2{font-size:20px;margin:0}p{line-height:1.7}fieldset{border:1px solid #bfd0e6;border-radius:10px}button{padding:12px 20px;border-radius:8px;border:1px solid #b45656;background:#ffe4e4;cursor:pointer}button:disabled{opacity:.5;cursor:default}small{display:block;margin-top:12px}
`;
const Fields=styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;label{display:flex;flex-direction:column;gap:6px;font-size:12px}input,select{padding:10px;border:1px solid #adc0d9;border-radius:8px;color:#1e3271;background:white;min-width:0}`;
