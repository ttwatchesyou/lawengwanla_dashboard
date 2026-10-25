export type GripperPacket={ms:number;axis:"idle"|"stepper"|"lift";direction:number;speed:number;commanded_steps:number;homed:boolean;raw_mask:number;active_mask:number;reason:number;stepper_enabled:boolean;homing?:boolean;max_steps?:number};
export const GRIPPER_REASONS=["หยุด","ขาด heartbeat","ครบเวลาสั่งงาน 30 วินาที","ถึงลิมิต","ถึงขอบเขตพัลส์","ต้องหาศูนย์ PA2 ก่อน","ต้องตั้งจำนวนพัลส์สูงสุดก่อน","หาศูนย์ไม่พบภายใน 30 วินาที"];

// Directional interlocks: a held switch must never disable the escape direction.
export function gripperCanJog(packet:GripperPacket|null,axis:"stepper"|"lift",direction:number,maxSteps:number){
  if(!packet || (direction!==-1 && direction!==1))return false;
  if(axis==="lift")return !(packet.active_mask&(direction===1?1:2));
  if(direction===-1)return !(packet.active_mask&4) && (!packet.homed || packet.commanded_steps>0);
  return packet.homed && Number.isInteger(maxSteps) && maxSteps>=0 && (maxSteps===0 || packet.commanded_steps<maxSteps);
}

export type GripperTarget="left"|"center"|"right"|"up"|"down";
export function gripperCanTarget(packet:GripperPacket|null,target:GripperTarget,maxSteps:number){
  if(!packet || packet.axis!=="idle")return false;
  if(target==="left")return !(packet.active_mask&4);
  if(target==="up"||target==="down")return !(packet.active_mask&(target==="up"?1:2));
  if(!packet.homed||!Number.isInteger(maxSteps)||maxSteps<=0)return false;
  const destination=target==="center"?Math.floor(maxSteps/2):maxSteps;
  if(destination<packet.commanded_steps&&(packet.active_mask&4))return false;
  return packet.commanded_steps!==destination;
}
