import { subscribeJson } from "../utils/readPolling";
import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_ROBOT_API ?? "";

export interface MissionStatus {
  mission_step: number;
  mission_total_steps: number;
  mission_running: boolean;
  team_color: "RED" | "BLUE" | "NONE";
  program_color: number;
  program_game: number;
  current_game: number;
  chair_count?: number;
}

export function useTelemetry(pollMs = 300) {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [detectedObjects, setDetectedObjects] = useState<{
    latest: string;
    log: any[];
  }>({ latest: "", log: [] });
  const [missionStatus, setMissionStatus] = useState<MissionStatus | null>(
    null
  );
  const [rosStatus, setRosStatus] = useState<"online" | "offline">("offline");

  useEffect(() => {
    const a=subscribeJson<any>(`${API_BASE}/api/telemetry`,data=>{setTelemetry(data);setRosStatus("online");},()=>setRosStatus("offline"),pollMs);
    const b=subscribeJson<any>(`${API_BASE}/api/detected_objects`,data=>setDetectedObjects({latest:data.latest??"",log:data.log??[]}),()=>{},Math.max(pollMs,500));
    const c=subscribeJson<MissionStatus>(`${API_BASE}/api/mission/status`,setMissionStatus,()=>{},Math.max(pollMs,500));
    return ()=>{a();b();c();};
  },[pollMs]);
  return { telemetry, detectedObjects, missionStatus, rosStatus };
}
