import {useEffect,useRef,useState} from "react";
import {subscribeJson} from "../utils/readPolling";
import {useReadClock} from "../utils/useReadClock";

type State={ready:boolean;relay_capable:boolean;ros_connected:boolean;age_ms:number|null;connection_epoch?:string;stop_generation?:number;relay_values:number[]|null;relay_error?:string;error?:string};
const pins=["PA3","PA5","PB0","PB1"];
const off=()=>[0,0,0,0];
export default function GripperRelayPanel(){
  const [state,setState]=useState<State|null>(null),[at,setAt]=useState(0),[wanted,setWanted]=useState(off),[error,setError]=useState("");
  const snapshot=useRef<State|null>(null),desired=useRef(off()),busy=useRef(false),mounted=useRef(true);
  const now=useReadClock(100);
  const live=!!(state?.ready&&state.relay_capable&&state.ros_connected&&state.age_ms!==null&&state.age_ms+Math.max(0,now-at)<400);
  const transmit=async()=>{
    if(busy.current)return;
    const current=snapshot.current;
    if(!current?.connection_epoch||current.stop_generation===undefined)return;
    busy.current=true;
    const values=[...desired.current];
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),900);
    try{
      const response=await fetch("/api/gripper-relays/command",{method:"POST",keepalive:true,signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({values,connection_epoch:current.connection_epoch,stop_generation:current.stop_generation})});
      const result=await response.json();if(!response.ok)throw Error(result.error||"ส่งรีเลย์ผ่าน ROS ไม่สำเร็จ");
    }catch(cause){desired.current=off();if(mounted.current){setWanted(off());setError((cause as Error).message);}}
    finally{
      clearTimeout(timeout);busy.current=false;
      if(values.some((v,i)=>v!==desired.current[i]))void transmit();
    }
  };
  const stop=()=>{desired.current=off();if(mounted.current)setWanted(off());void transmit();};
  useEffect(()=>{
    mounted.current=true;
    const subscription=subscribeJson<State>("/api/gripper-relays/state",(value,stamp)=>{
      const previous=snapshot.current;
      if(!value.ready||!value.relay_capable||previous?.connection_epoch!==value.connection_epoch||previous?.stop_generation!==value.stop_generation){desired.current=off();setWanted(off());}
      snapshot.current=value;setState(value);setAt(stamp.requestedAt);
    },cause=>{snapshot.current=null;desired.current=off();setWanted(off());setState(null);setError(cause.message);},200,1200);
    const interval=setInterval(()=>{if(desired.current.some(Boolean))void transmit();},100);
    const hidden=()=>{if(document.hidden)stop();};
    window.addEventListener("blur",stop);window.addEventListener("pagehide",stop);document.addEventListener("visibilitychange",hidden);
    return()=>{stop();mounted.current=false;subscription();clearInterval(interval);window.removeEventListener("blur",stop);window.removeEventListener("pagehide",stop);document.removeEventListener("visibilitychange",hidden);};
  },[]);
  const toggle=(i:number)=>{if(!live)return;desired.current=desired.current.map((v,j)=>j===i?1-v:v);setWanted([...desired.current]);setError("");void transmit();};
  return <section aria-label="รีเลย์ชุดจับผ่าน ROS"><h3>รีเลย์ชุดจับ · ยังไม่แมพทั้ง 4 ช่อง</h3>
    <p>{live?"เชื่อมต่อ ROS · พร้อมสั่งงาน":state?.relay_capable?"รอข้อมูลบอร์ดและ ROS":"รอเฟิร์มแวร์รีเลย์ 4 ช่อง"}</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:10}}>{pins.map((pin,i)=><button key={pin} type="button" disabled={!live} aria-pressed={!!wanted[i]} onClick={()=>toggle(i)}>
      รีเลย์ {i+1} · {pin} · ยังไม่แมพ · {live&&state?.relay_values?(state.relay_values[i]?"เปิด":"ปิด"):"รอข้อมูล"}{wanted[i]?" · สั่งเปิด":""}
    </button>)}<button type="button" onClick={stop}>ปิดรีเลย์ทั้งหมด</button></div>
    <small>กดเพื่อเปิด/ปิดแต่ละช่อง · เปิดพร้อมกันได้ · ออกจากหน้าหรือขาดการติดต่อจะปิดทั้งหมด</small>
    {(error||state?.relay_error)&&<p role="alert">{error||state?.relay_error}</p>}
  </section>;
}
