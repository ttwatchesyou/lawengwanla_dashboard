import ServoCalibrationPanel from "./ServoCalibrationPanel";
import GripperRelayPanel from "./GripperRelayPanel";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { subscribeJson } from "../utils/readPolling";
import { useReadClock } from "../utils/useReadClock";
import { GripperPacket, GRIPPER_REASONS as reasons, gripperCanTarget, GripperTarget } from "../utils/gripperAxes";

type State={servo_only?:boolean;connected:boolean;ready:boolean;connection_epoch?:string;stop_generation?:number;age_ms:number|null;packet:GripperPacket|null;uid?:string;port?:string;error?:string;roles?:string[];en_active_low?:boolean|null;firmware_version?:number;relay_capable?:boolean;target_capable?:boolean;max_steps?:number;diagnostics?:{step_dir:number;step_enable:number;step_pulse:number;lift_dir:number;pwm_arr:number;pwm_ccr:number;pwm_running:boolean;pwm_percent:number;pin_modes:Record<string,number>}|null;diagnostics_age_ms?:number|null;autoconnect?:{automatic:boolean;phase:string;binding:{uid:string;usb:{serial:string|null;location:string|null}}|null;error:string|null}};
type Gesture={id:string;epoch:string;generation:number;acknowledged:boolean;busy:boolean;boardMs:number};
const initial:State={connected:false,ready:false,age_ms:null,packet:null};
const roleNames:Record<string,string>={unassigned:"ยังไม่กำหนดหน้าที่",step_zero:"ศูนย์ stepping",lift_up:"ลิมิตบน",lift_down:"ลิมิตล่าง"};

export default function GripperAxesPanel(){
  const [state,setState]=useState<State>(initial),[at,setAt]=useState(0);
  const [message,setMessage]=useState(""),[moving,setMoving]=useState(false);
  const [maxDraft,setMaxDraft]=useState(0),[enDraft,setEnDraft]=useState(false),[saving,setSaving]=useState(false);
  const settingsDirty=useRef(false);
  const snapshot=useRef(initial),gesture=useRef<Gesture|null>(null),mounted=useRef(true);
  const now=useReadClock(100);
  const fresh=state.connected && state.ready && state.age_ms!==null && state.age_ms+Math.max(0,now-at)<400;
  const firmwareReady=(state.firmware_version??1)>=2&&state.relay_capable===true&&state.target_capable===true;
  const canTarget=(target:GripperTarget)=>fresh&&firmwareReady&&!saving&&!moving&&gripperCanTarget(state.packet,target,state.max_steps??0);
  const accept=(value:State,requestedAt:number)=>{
    snapshot.current=value;
    const active=gesture.current;
    if(active?.acknowledged && value.packet && (value.connection_epoch!==active.epoch || value.stop_generation!==active.generation || value.packet.ms>active.boardMs && value.packet.axis==="idle")){
      gesture.current=null;if(mounted.current)setMoving(false);
    }
    if(mounted.current){setState(value);setAt(requestedAt);if(!settingsDirty.current){setMaxDraft(value.max_steps??0);setEnDraft(value.en_active_low??false);}}
  };
  const request=async(action:string,body?:Record<string,unknown>)=>{
    const response=await fetch(`/api/gripper-axes/${action}`,{method:body?"POST":"GET",cache:"no-store",
      ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"ส่งคำสั่งบอร์ดชุดจับไม่ได้");return data;
  };
  const stop=(force=false)=>{
    const active=gesture.current;gesture.current=null;if(mounted.current)setMoving(false);
    if(!active && !force)return;
    const started=performance.now();
    void request("command",{action:"stop"}).then(value=>accept(value,started)).catch(cause=>{if(mounted.current)setMessage(cause.message);});
  };
  useEffect(()=>{
    mounted.current=true;
    const unsubscribe=subscribeJson<State>("/api/gripper-axes/state",(value,stamp)=>accept(value,stamp.requestedAt),cause=>{
      snapshot.current=initial;if(mounted.current){setState(initial);setMessage(cause.message);}
      if(gesture.current)stop();
    },200,900);
    // Command renewal is independent of read-only visibility polling.
    const heartbeat=setInterval(()=>{
      const active=gesture.current;if(!active || !active.acknowledged || active.busy)return;
      active.busy=true;
      void request("command",{action:"keep",gesture:active.id,connection_epoch:active.epoch,stop_generation:active.generation})
        .catch(async cause=>{if(gesture.current===active){
          try{const stamp=performance.now();const latest=await request("state");accept(latest,stamp);if(!gesture.current)return;}catch{}
          if(gesture.current===active){if(mounted.current)setMessage(cause.message);stop();}
        }})
        .finally(()=>{active.busy=false;});
    },100);
    const leave=()=>stop(),hidden=()=>{if(document.hidden)leave();};
    window.addEventListener("blur",leave);window.addEventListener("pagehide",leave);document.addEventListener("visibilitychange",hidden);
    return ()=>{mounted.current=false;unsubscribe();clearInterval(heartbeat);window.removeEventListener("blur",leave);window.removeEventListener("pagehide",leave);document.removeEventListener("visibilitychange",hidden);leave();};
  },[]);
  const start=async(target:GripperTarget)=>{
    if(gesture.current||!canTarget(target))return;
    const current=snapshot.current;
    if(!current.connection_epoch||current.stop_generation===undefined)return;
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    const active:Gesture={id:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join(""),epoch:current.connection_epoch,generation:current.stop_generation,acknowledged:false,busy:false,boardMs:current.packet?.ms??0};
    gesture.current=active;setMoving(true);setMessage("");
    try{
      const accepted=await request("command",{action:"move",target,gesture:active.id,connection_epoch:active.epoch,stop_generation:active.generation});
      if(gesture.current===active){active.boardMs=accepted.packet?.ms??active.boardMs;active.acknowledged=true;}
    }catch(cause){if(gesture.current===active){setMessage((cause as Error).message);stop();}}
  };
  const saveSettings=async()=>{
    if(!fresh || !firmwareReady || moving || !Number.isInteger(maxDraft) || maxDraft<0 || maxDraft>1000000)return;
    setSaving(true);setMessage("");
    try{
      const stamp=performance.now();const latest=await request("command",{action:"setup",max_steps:maxDraft,en_active_low:enDraft,connection_epoch:snapshot.current.connection_epoch,stop_generation:snapshot.current.stop_generation});
      settingsDirty.current=false;accept(latest,stamp);
    }catch(cause){setMessage((cause as Error).message);}finally{setSaving(false);}
  };
  const packet=state.packet;
  const active=(axis:"stepper"|"lift",direction?:number)=>!!(fresh&&packet?.axis===axis&&(direction===undefined||packet.direction===direction));
  const automatic=state.autoconnect;
  return <><ServoCalibrationPanel/>{state.servo_only?null:<Panel aria-label="บอร์ด stepping และ Cytron ขึ้นลง">
    <Top><div><small>GRIPPER · SENSOR CONTROL</small><h2>โมเดลชุดเลื่อนและชุดขึ้น–ลง</h2></div><Badge $ready={!!fresh} role="status">{fresh?"เชื่อมต่อ · พร้อมสั่งงาน":state.connected?"เชื่อมต่อ · รอข้อมูลสด":automatic?.binding?"รอบอร์ดเดิม · เชื่อมต่ออัตโนมัติ":automatic?.phase==="verifying"?"กำลังตรวจบอร์ดอัตโนมัติ":"รอเสียบบอร์ด · เชื่อมต่ออัตโนมัติ"}</Badge></Top>
    <p>กดครั้งเดียวเพื่อวิ่งถึงเป้าหมาย · ถึงลิมิตแล้วหยุดและถอยทิศตรงข้ามได้ · กดหยุดเพื่อยกเลิก</p>
    {!firmwareReady&&<ErrorText role="alert">รออัปโหลดเฟิร์มแวร์กดครั้งเดียวถึงเป้าหมายบนบอร์ด</ErrorText>}
    <Workspace>
      <Model>
        <svg viewBox="0 0 600 420" role="group" aria-label="โมเดลชุดจับ กดซ้าย กลาง ขวา ขึ้น ลงเพื่อวิ่งถึงเป้าหมาย">
          <defs>
            <linearGradient id="gripper-axes-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6384a5"/><stop offset="1" stopColor="#253e59"/></linearGradient>
            <pattern id="gripper-axes-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#6a8aa8" opacity=".25"/></pattern>
          </defs>
          <rect width="600" height="420" fill="url(#gripper-axes-grid)"/>
          <text x="300" y="30" textAnchor="middle" className="model-title">ชุดจับเลื่อนซ้าย–ขวา / ขึ้น–ลง</text>
          <ellipse cx="300" cy="366" rx="183" ry="13" fill="#081422"/>
          <g opacity={fresh?1:.5}>
            <rect x="135" y="95" width="18" height="250" rx="6" fill="url(#gripper-axes-metal)" stroke={active("lift")?"#f4bd60":"#7b96b1"}/>
            <rect x="447" y="95" width="18" height="250" rx="6" fill="url(#gripper-axes-metal)" stroke={active("lift")?"#f4bd60":"#7b96b1"}/>
            <path d="M154 107H446M154 333H446" stroke="#486681" strokeWidth="10"/>
            <rect x="153" y="183" width="294" height="32" rx="7" fill="#1b334c" stroke={active("stepper")?"#f4bd60":"#86a2bb"} strokeWidth="2"/>
            <path d="M172 199H428" stroke="#b0c5d6" strokeWidth="4"/>
            <g data-testid="gripper-axes-carriage" data-axis={fresh?packet?.axis:"unknown"} transform={packet?.homed&&(state.max_steps??0)>0?`translate(${220*(Math.min(1,Math.max(0,packet.commanded_steps/(state.max_steps??1)))-.5)},0)`:undefined}>
              <rect x="265" y="169" width="70" height="61" rx="9" fill="url(#gripper-axes-metal)" stroke={active("stepper")||active("lift")?"#f4bd60":"#aec5d9"} strokeWidth="2"/>
              <path d="M280 230V252H290M320 230V252H310" stroke="#b5cbdc" strokeWidth="7" fill="none"/>
              <text x="300" y="204" textAnchor="middle" className="model-label">ชุดจับ</text>
            </g>
            <rect x="124" y="345" width="352" height="22" rx="9" fill="url(#gripper-axes-metal)" stroke="#6e8eaa"/>
          </g>
          <foreignObject x="15" y="169" width="116" height="64"><ModelButton aria-label="ไปซ้ายจนชนลิมิต" disabled={!canTarget("left")} $active={active("stepper",-1)} onClick={()=>void start("left")}>◀ ไปซ้าย</ModelButton></foreignObject>
          <foreignObject x="469" y="169" width="116" height="64"><ModelButton aria-label="ไปขวาสุด" disabled={!canTarget("right")} $active={active("stepper",1)} onClick={()=>void start("right")}>ไปขวา ▶</ModelButton></foreignObject>
          <foreignObject x="242" y="50" width="116" height="64"><ModelButton aria-label="ขึ้นจนชนลิมิต" disabled={!canTarget("up")} $active={active("lift",1)} onClick={()=>void start("up")}>▲ ขึ้น</ModelButton></foreignObject>
          <foreignObject x="242" y="282" width="116" height="64"><ModelButton aria-label="ลงจนชนลิมิต" disabled={!canTarget("down")} $active={active("lift",-1)} onClick={()=>void start("down")}>▼ ลง</ModelButton></foreignObject>
          <text x="300" y="276" textAnchor="middle" className="model-caption">{!fresh?"รอข้อมูลบอร์ด":active("stepper")?`กำลังเลื่อน${packet?.direction===1?"ขวา":"ซ้าย"}`:active("lift")?`กำลังเคลื่อน${packet?.direction===1?"ขึ้น":"ลง"}`:"หยุด"}</text>
          <text x="300" y="399" textAnchor="middle" className="model-caption">{packet?.homed?"ตำแหน่งจากพัลส์คำสั่ง · ไม่มี encoder":"ยังไม่มีศูนย์อ้างอิง · กดหาศูนย์ PA2 ก่อน"}</text>
        </svg>
      </Model>
      <Axes><Axis><h3>↔ ชุดจับเลื่อนซ้าย–ขวา</h3><p>ความเร็วคงที่ 1,500 พัลส์/วินาที</p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button disabled={!canTarget("left")} onClick={()=>void start("left")}>ซ้าย · หาศูนย์ PA2</button>
        <button aria-label="ไปตรงกลาง" disabled={!canTarget("center")} onClick={()=>void start("center")}>ตรงกลาง · {Math.floor((state.max_steps||10882)/2).toLocaleString()} พัลส์</button>
        <button disabled={!canTarget("right")} onClick={()=>void start("right")}>ขวาสุด · {(state.max_steps||10882).toLocaleString()} พัลส์</button>
      </div>
      <p>พัลส์คำสั่ง: <strong>{fresh?packet?.commanded_steps??"—":"—"}</strong> / {state.max_steps||"ยังไม่จำกัดขวา"}<br/>{packet?.homed?"อ้างอิงศูนย์แล้ว":"ต้องหาศูนย์ก่อนเลื่อนออก"}</p>
      <small>ซ้ายหยุดที่ PA2 · ขวาหยุดที่ขอบพัลส์ · กลางหยุดครึ่งระยะ · ออกจากหน้าจะหยุด</small></Axis>
      <Axis><h3>↕ ชุดจับขึ้น–ลง</h3><p>กำลังคงที่ PWM 70% · กดขึ้น/ลงครั้งเดียวจนถึงลิมิต</p><p>สถานะ: <strong>{fresh&&packet?reasons[packet.reason]??"—":"รอข้อมูล"}</strong><br/>{!fresh?"ยังไม่ทราบ PWM":packet?.axis==="lift"?`PWM 70% (${packet.speed}/255)`:"PWM 0 / ไม่ทำงาน"}</p></Axis></Axes>
    </Workspace>
    <Limits>{["PA0","PA1","PA2"].map((pin,i)=>{const active=fresh&&packet?!!(packet.active_mask&(1<<i)):null;return <Limit key={pin} $active={active===true}><strong>{pin}</strong><span>{active===null?"รอข้อมูล":active?"ลิมิตทำงาน":"ลิมิตไม่ทำงาน"}</span><small>ระดับขา: {fresh&&packet?((packet.raw_mask&(1<<i))?"HIGH":"LOW"):"—"}</small><small>{roleNames[state.roles?.[i]??"unassigned"]}</small></Limit>;})}</Limits>
    <Stop onClick={()=>stop(true)}>หยุดชุดเลื่อน ชุดขึ้น–ลง และรีเลย์ทั้งหมด</Stop>
    <small>{automatic?.binding?"จำบอร์ดแล้ว · ถอดเสียบใหม่จะเชื่อมต่อกลับเอง":"ระบบจะจำบอร์ดให้อัตโนมัติเมื่อตรวจพบครั้งแรก"} · PA0 สุดขึ้น · PA1 สุดลง · PA2 ศูนย์ stepping</small>
    <GripperRelayPanel/>
    <details><summary>รายละเอียดบอร์ดและตรวจขับมอเตอร์</summary><p>TB6600 · {state.diagnostics?.pin_modes.PA8!==undefined?"PA8":state.diagnostics?.pin_modes.PB10!==undefined?"PB10":state.diagnostics?.pin_modes.PB3!==undefined?"PB3":"PB4"} DIR · {state.diagnostics?.pin_modes.PA7!==undefined?"PA7":"PA6"} STEP · PA4 EN<br/>Cytron MD10R · PB15 DIR · {state.diagnostics?.pin_modes.PB6!==undefined?"PB6":"PB5"} PWM<br/>บอร์ด {state.uid||automatic?.binding?.uid||"รอตรวจพบ"} · {state.connected?state.port:"ยังไม่เชื่อมต่อ"} · เฟิร์มแวร์ {state.firmware_version??1}</p>
      <label>ระดับ EN ที่ให้ TB6600 ทำงาน <select aria-label="ระดับ EN ขณะทำงาน" value={enDraft?"low":"high"} disabled={moving||saving} onChange={e=>{settingsDirty.current=true;setEnDraft(e.target.value==="low");}}><option value="high">HIGH</option><option value="low">LOW</option></select></label> <button disabled={!fresh||!firmwareReady||moving||saving} onClick={()=>void saveSettings()}>บันทึกการตั้งค่าไดรเวอร์</button>
      {fresh&&state.diagnostics&&state.diagnostics_age_ms!=null&&state.diagnostics_age_ms+Math.max(0,now-at)<1000?<p>อ่านกลับจากบอร์ด: {state.diagnostics.pin_modes.PA8!==undefined?"PA8":state.diagnostics.pin_modes.PB10!==undefined?"PB10":state.diagnostics.pin_modes.PB3!==undefined?"PB3":"PB4"} DIR={state.diagnostics.step_dir} · PA4 EN={state.diagnostics.step_enable} · {state.diagnostics.pin_modes.PA7!==undefined?"PA7":"PA6"} STEP={state.diagnostics.step_pulse}<br/>PB15 DIR={state.diagnostics.lift_dir} · Timer PWM={state.diagnostics.pwm_percent}% · CCR={state.diagnostics.pwm_ccr}/{state.diagnostics.pwm_arr+1} · {state.diagnostics.pwm_running?"Timer ทำงาน":"Timer หยุด"}</p>:<p>รอข้อมูลขาออกจากเฟิร์มแวร์ใหม่</p>}
    </details>
    {(message||state.error||automatic?.error)&&<ErrorText role="alert">{message||state.error||automatic?.error}</ErrorText>}
  </Panel>}</>;
}
const Panel=styled.section`margin:22px 0;padding:24px;border-radius:18px;background:#fff;border:1px solid #d9e2e8;box-shadow:0 8px 24px #20365108;h2{margin:7px 0 0;font-size:22px}small{color:#65798a}p{line-height:1.65;color:#65798a}button,select,input{font:inherit}button{cursor:pointer;border:1px solid #ced9e0;border-radius:9px;background:#f2f7fa;padding:11px 15px;color:#203651}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:700px){padding:16px}`;
const Top=styled.div`display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap`;
const Badge=styled.span<{$ready:boolean}>`padding:8px 12px;border-radius:20px;background:${p=>p.$ready?"#e0f5eb":"#fff4d8"};color:${p=>p.$ready?"#176649":"#785b23"};font-size:13px`;
const Workspace=styled.div`display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,1fr);gap:18px;align-items:stretch;@media(max-width:950px){grid-template-columns:1fr}`;
const Model=styled.div`background:#12263b;border:1px solid #38536e;border-radius:14px;overflow:hidden;display:flex;align-items:center;svg{width:100%;height:auto;display:block}.model-title{fill:#d3e4f2;font-size:17px;font-weight:600}.model-label{fill:#edf5fb;font-size:16px;font-weight:600}.model-caption{fill:#9db4c9;font-size:14px}`;
const ModelButton=styled.button<{$active:boolean}>`&&{width:100%;min-height:56px;padding:8px 4px;background:${p=>p.$active?"#f4bd60":"#203b56"};border:1px solid ${p=>p.$active?"#f4bd60":"#8ba8c2"};color:${p=>p.$active?"#25364a":"#eff7ff"};font-size:17px;font-weight:600;touch-action:none;user-select:none}&&:focus-visible{outline:3px solid #73d7f9;outline-offset:-4px}`;
const Axes=styled.div`display:grid;gap:14px;@media(min-width:650px) and (max-width:950px){grid-template-columns:1fr 1fr}`;
const Axis=styled.div`background:#f7fafb;border:1px solid #e0e8ed;border-radius:12px;padding:18px;h3{margin:0 0 8px}label{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:18px 0}input{width:100px;border:1px solid #cad7df;border-radius:8px;padding:9px}`;
const Limits=styled.div`display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0;@media(max-width:600px){grid-template-columns:1fr}`;
const Limit=styled.div<{$active:boolean}>`padding:14px;display:flex;flex-direction:column;gap:6px;border-radius:10px;border:1px solid ${p=>p.$active?"#65bda0":"#d8e1e7"};background:${p=>p.$active?"#e3f7ef":"#f8fafb"}`;
const Stop=styled.button`&&{width:100%;background:#b52e3b;color:#fff;border:0;font-weight:700;margin-bottom:12px}`;
const ErrorText=styled.p`&&{color:#a32b39}`;
