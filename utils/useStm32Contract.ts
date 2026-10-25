import {useEffect,useState} from "react";
import type {Stm32Contract} from "./stm32Contract";
export default function useStm32Contract() {
  const [contract,setContract]=useState<Stm32Contract|null>(null),[error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_ROBOT_API || ""}/api/tuner/contract`,{cache:"no-store",signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error("อ่านข้อมูลคำสั่ง STM32 ไม่สำเร็จ");return r.json();})
      .then(data=>{if(!["stm32_pose_only_v26","stm32_pose_speed_v27","stm32_original_gvps"].includes(data.protocol))throw Error("รูปแบบคำสั่ง STM32 ไม่ตรงกับหน้าเว็บ");setContract(data);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[]);
  return {contract,error};
}
