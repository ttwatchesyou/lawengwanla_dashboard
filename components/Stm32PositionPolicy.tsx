import type {Stm32Contract} from "../utils/stm32Contract";
export default function Stm32PositionPolicy({contract,error}:{contract:Stm32Contract|null;error?:string|null}) {
  const p=contract?.position;
  const original=contract?.protocol==="stm32_original_gvps";
  const tolerance=contract?.goal_stop_policy?.GOAL_POSITION_TOLERANCE_M ?? p?.position_tolerance_m;
  return <section aria-label="ค่าควบคุมตำแหน่งใน STM32">
    <p>{original ? "Maze ส่ง S เลือกสปีด/PID Profile ตามด้วย P5 ตั้งเพดานหมุน และ G ส่งเป้า · STM32 คุม PID · เว็บติดตามตำแหน่งวัดจริงและส่ง X เมื่อจบ" : "ส่งเป้า X/Y/yaw พร้อมความเร็ววิ่งและหมุน · STM32 อ่านเซนเซอร์ ควบคุมล้อ · ไม่ต้องส่งเป้าซ้ำ"}</p>
    {error && <p role="alert">{error}</p>}
    {!p ? <p>{contract?"ยังอ่านไฟล์ค่าควบคุมไม่ได้":"กำลังอ่านข้อมูลคำสั่งบอร์ด…"}</p> : <>
      <p>ความเร็วเริ่มต้น {p.cruise_mps.toFixed(2)} m/s · yaw สูงสุด {original ? `${p.yaw_max_rpm ?? "—"} RPM` : `${p.angular_max_radps.toFixed(2)} rad/s`} · คลาดเคลื่อนตำแหน่ง {Number.isFinite(tolerance) ? `${(tolerance!*100).toFixed(1)} ซม.` : "ตามเฟิร์มแวร์ที่แฟลช"} · มุม {(p.yaw_tolerance_rad*180/Math.PI).toFixed(2)}°</p>
      <p>X PID {p.x.kp}/{p.x.ki}/{p.x.kd} · Y PID {p.y.kp}/{p.y.ki}/{p.y.kd} · Yaw PD {p.yaw_kp}/{p.yaw_kd} · PWM {(contract!.pwm_hz/1000).toFixed(0)} kHz</p>
      <small>ค่าเริ่มต้นจากไฟล์ {contract!.config_source} ไม่ใช่ค่าที่อ่านกลับจากบอร์ด · {original ? "แก้ PID ใน Wheel Tuner ได้ · tolerance รายจุดใช้ตรวจการถึงเป้าฝั่ง Mainprogram; deadband ของบอร์ดยังตั้งในเฟิร์มแวร์" : "ปรับ PID X/Y และ Yaw PD ได้เมื่อใช้ v27-tuning"}</small>
    </>}
  </section>;
}
