export type PositionGoal = {x:number;y:number;yaw:number;linear_mps?:number;angular_radps?:number};
export type Stm32Contract = {
  protocol:string;position_payload:string[];position_heartbeat:boolean;runtime_position_tuning:boolean;
  position_speed_payload?:boolean;required_speed_firmware?:string;final_target_hold:boolean;pwm_hz:number;config_source:string;config_is_device_readback:boolean;
  required_pid_firmware?:string;yaw_pid_integral?:boolean;goal_stop_policy?:Record<string,number>;
  position:null|{x:{kp:number;ki:number;kd:number};y:{kp:number;ki:number;kd:number};yaw_kp:number;yaw_kd:number;
    yaw_max_rpm?:number;cruise_mps:number;linear_limit_mps:number;angular_max_radps:number;position_tolerance_m:number;yaw_tolerance_rad:number};
};
export function positionGoalRequest(goal:PositionGoal,contract:Stm32Contract|null) {
  if(!contract || !["stm32_pose_only_v26","stm32_pose_speed_v27"].includes(contract.protocol))throw Error("ยังไม่พร้อมส่งเป้า · รอข้อมูลคำสั่ง STM32");
  const {x,y,yaw}=goal;
  if(![x,y,yaw].every(v=>typeof v==="number" && Number.isFinite(v)) || Math.abs(x)>=1000 || Math.abs(y)>=1000)
    throw Error("เป้า x/y/yaw ต้องเป็นตัวเลขที่ถูกต้อง และ |x|, |y| น้อยกว่า 1000 เมตร");
  const speeds=goal.linear_mps!==undefined || goal.angular_radps!==undefined;
  if(speeds && (!contract.position_speed_payload || !Number.isFinite(goal.linear_mps) || !Number.isFinite(goal.angular_radps) || goal.linear_mps!<.01 || goal.linear_mps!>3.40282e38 || goal.angular_radps!<.01 || goal.angular_radps!>5))
    throw Error("ความเร็ววิ่งต้องเป็นค่าบวกตั้งแต่ 0.01 m/s และความเร็วหมุน 0.01–5 rad/s · ต้องใช้ STM32 v27");
  return {action:"goal",x,y,yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),...(speeds?{linear_mps:goal.linear_mps,angular_radps:goal.angular_radps}:{})};
}
export async function sendPositionGoal(request:(path:string,body:Record<string,unknown>)=>Promise<unknown>,goal:PositionGoal,contract:Stm32Contract|null) {
  return request("/api/tuner/command",positionGoalRequest(goal,contract));
}
