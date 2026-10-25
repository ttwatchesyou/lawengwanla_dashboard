import { startVisiblePolling, readWasCancelled } from "./readPolling";
import { useReadClock } from "./useReadClock";
import { useEffect, useRef, useState } from "react";
import { RobotPose } from "./robotSimulation";
import { actualMotion, finiteVector, livePoseFresh, MainprogramState, MapAnchor, measuredPose, startReference, validAnchor } from "./liveOdometry";
import { ExecutionSettings } from "./mainprogramSettings";

export default function useLiveOdometry(settings: ExecutionSettings, settingsLoaded = true) {
  const [state,setState]=useState<MainprogramState>({status:"ERROR",reason:"รอสถานะ Mainprogram"});
  const [display,setDisplay]=useState<{pose:RobotPose|null;raw:number[]|null;trace:RobotPose[];key:string;anchor:MapAnchor|null}>({pose:null,raw:null,trace:[],key:"",anchor:null});
  const [error,setError]=useState(true),[requestedAt,setRequestedAt]=useState(0);
  const now = useReadClock(100);
  const cursor=useRef(0),epoch=useRef("");
  const start=useRef<MapAnchor|null>(null);
  const config=useRef({settings,settingsLoaded});
  config.current={settings,settingsLoaded};
  useEffect(() => {
    // A cursor is local to this reader; don't replay the complete backend buffer.
    let done=false;
    const poller = startVisiblePolling(async signal => {
      const started=performance.now();
      try {
        const response=await fetch(`/api/mainprogram/state?after=${cursor.current}`,{cache:"no-store",signal});
        const data:MainprogramState=await response.json();
        if(done || signal.aborted)return;
        const replayed=data.pose_epoch===epoch.current && Number.isSafeInteger(data.pose_sequence) && (data.pose_sequence ?? 0)<cursor.current;
        setState(data);setRequestedAt(started);setError(!response.ok || replayed);
        const fresh=livePoseFresh(data,started,performance.now(),!response.ok || replayed);
        if(data.pose_epoch && epoch.current!==data.pose_epoch){epoch.current=data.pose_epoch;cursor.current=0;}
        if(fresh && finiteVector(data.pose) && config.current.settingsLoaded){
          if(!start.current || start.current.pose_epoch!==data.pose_epoch) start.current=startReference(data,config.current.settings);
          const anchor=validAnchor(data.map_anchor,data.pose_epoch)?data.map_anchor:start.current;
          const key=`${data.pose_epoch}:${anchor.id}`,raw=data.pose,previous=cursor.current;
          const samples=(Array.isArray(data.pose_samples)?data.pose_samples:[]).filter(s=>s.pose_epoch===data.pose_epoch && Number.isSafeInteger(s.sequence) && s.sequence>previous && (!anchor || s.sequence>=anchor.pose_sequence) && finiteVector(s.pose));
          cursor.current=Math.max(previous,data.pose_sequence ?? 0);
          setDisplay(old=>{
            const changed=old.key!==key,pose=measuredPose(raw,anchor);
            const points=samples.map(s=>measuredPose(s.pose,anchor));
            if(!points.length && (changed || (data.pose_sequence ?? 0)>previous))points.push(pose);
            const trace=changed?[]:[...old.trace];
            // This is only the drawn trail. Full measurement samples stay in the backend.
            for(const point of points){
              const last=trace[trace.length-1];
              if(!last || Math.hypot(last.x-point.x,last.y-point.y)>=.002)trace.push(point);
            }
            const samePose=old.pose?.x===pose.x && old.pose?.y===pose.y && old.pose?.heading===pose.heading;
            return {anchor,pose:samePose?old.pose:pose,raw,trace:!changed && trace.length===old.trace.length?old.trace:trace.slice(-1200),key};
          });
        }
      }catch{if(!done && !readWasCancelled(signal)){setError(true);setState(old=>({...old,status:"ERROR",ready:false,reason:"ติดต่อ Mainprogram ไม่ได้"}));}}
    },150,{timeoutMs:700});
    return ()=>{done=true;poller.stop();};
  },[]);
  const fresh=livePoseFresh(state,requestedAt,now,error);
  const anchor=display.anchor;
  return {state,pose:display.pose,raw:display.raw,trace:display.trace,fresh,anchor,
    motion:actualMotion(display.raw,state.twist_world,fresh),frame:anchor?"MAP":"ODOM"};
}
export type LiveOdometry = ReturnType<typeof useLiveOdometry>;
