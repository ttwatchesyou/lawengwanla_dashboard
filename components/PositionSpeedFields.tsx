import {NumericField} from "./tuner/NumericField";
export type PositionSpeeds={linear_mps:number;angular_radps:number};
export default function PositionSpeedFields({value,onChange}:{value:PositionSpeeds;onChange:(next:PositionSpeeds)=>void}) {
  return <div aria-label="ความเร็วสำหรับเป้าหมาย">
    <NumericField label="ความเร็ววิ่ง (m/s)" value={value.linear_mps} onChange={linear_mps=>onChange({...value,linear_mps})}/>
    <NumericField label="ความเร็วหมุน (rad/s)" value={value.angular_radps} onChange={angular_radps=>onChange({...value,angular_radps})}/>
    <small>วิ่งตั้งแต่ 0.01 m/s ตามกำลังชุดขับ · หมุน 0.01–5 rad/s · เร่ง 0.1 วินาที แล้ว PID คุมเข้าเป้า</small>
  </div>;
}
