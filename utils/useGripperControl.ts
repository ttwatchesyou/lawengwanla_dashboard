import { subscribeJson } from "./readPolling";
import { useEffect, useRef, useState } from "react";
import { GripperFloor, GripperMotion, GripperPositions } from "./useGripperSimulation";

export type GripperTarget = "left" | "center" | "right";
type Motion = {active: boolean; gesture: string | null; floor: number | null; target: GripperTarget | null;
  status?: "IDLE" | "RUN" | "ERROR" | "FINISH"; recovering?: boolean; phase: string; reason: string | null; result: string | null; last_stop?: {floor: number; reason: string; result: string; timestamp: number}; limits_fresh: boolean; inductive_ready: Record<string, boolean>};
type Status = {boards?: {relay: boolean; limit: boolean; inductive: boolean}; ready: boolean; ros_connected: boolean; ignored_limits?: number[]; grippers?: Record<string, GripperMotion>; motion?: Motion};
type Gesture = {id: string; floor: GripperFloor; target: GripperTarget; counter: number; busy: boolean};
const initial = (): GripperPositions => ({
  1: {position: 0.5, target: 0.5, moving: false, known: false},
  2: {position: 0.5, target: 0.5, moving: false, known: false},
  3: {position: 0.5, target: 0.5, moving: false, known: false},
  front: {position: 0.5, target: 0.5, moving: false, known: false},
});
const reasonText: Record<string, string> = {
  "Target sensor reached": "ถึงเซนเซอร์จุดหมายแล้ว",
  "Target limit is temporarily excluded": "ลิมิตจุดนี้ถูกข้ามชั่วคราว จึงวิ่งไปจุดนี้ไม่ได้",
  "Inductive data unavailable or stale": "ข้อมูลอินดักทีฟยังไม่พร้อม หรือหยุดอัปเดต",
  "Relay board or limit data not ready": "รอบอร์ดรีเลย์และข้อมูลลิมิตให้พร้อม",
  "Relay feedback timeout or firmware identity not received": "ข้อมูลยืนยันจากบอร์ดรีเลย์ขาดหาย · หยุดแล้ว",
  "Relay firmware watchdog stopped outputs": "บอร์ดรีเลย์ตัดเพราะคำสั่งขาดช่วง",
  "Relay serial data corrupted; release and press again": "ข้อมูลรีเลย์ผิดรูป · หยุดแล้ว",
  "Relay board unavailable": "บอร์ดรีเลย์ขาดการเชื่อมต่อ",
  "Limit data stale": "ข้อมูลลิมิตหยุดอัปเดต · หยุดมอเตอร์แล้ว",
  "Conflicting position sensors": "เซนเซอร์ของชั้นนี้รายงานตำแหน่งขัดกัน · หยุดแล้ว",
  "End limit reached before inductive center": "พบลิมิตปลายทางก่อนอินดักทีฟตรงกลาง · หยุดแล้ว",
  "Unexpected floor limit pressed": "มีลิมิตอีกจุดทำงาน · หยุดแล้ว",
  "Stopped by operator": "สั่งหยุดแล้ว",
  "Stop the current motion first": "กดหยุดชุดจับก่อนเลือกจุดหมายใหม่",
  "Boards reconnected; waiting for relay release": "บอร์ดกลับมาแล้ว · รอรีเลย์ดับก่อนวิ่งต่อ",
  "Relay session initialized; waiting for feedback": "รอบอร์ดสั่งรีเลย์ยืนยันก่อนวิ่งต่อ",
  "Limit board disconnected": "บอร์ดอ่านลิมิตหลุด · รอเชื่อมต่อเพื่อวิ่งต่อ",
  "Inductive board disconnected": "บอร์ดอ่านอินดักทีฟหลุด · รอเชื่อมต่อเพื่อวิ่งต่อ",
  "Relay board restarted": "บอร์ดสั่งรีเลย์เริ่มใหม่ · รอพร้อมเพื่อวิ่งต่อ",
  "Limit board restarted": "บอร์ดอ่านลิมิตเริ่มใหม่ · รอข้อมูลเพื่อวิ่งต่อ",
  "Inductive board restarted": "บอร์ดอ่านอินดักทีฟเริ่มใหม่ · รอข้อมูลเพื่อวิ่งต่อ",
  "Waiting for relay release": "รอรีเลย์หยุดก่อนเริ่มทิศใหม่",
};
export const gripperReason = (value?: string | null) => reasonText[value ?? ""] ?? value ?? "";

export default function useGripperControl() {
  const [status, setStatus] = useState<Status | null>(null);
  const [positions, setPositions] = useState<GripperPositions>(initial);
  const [message, setMessage] = useState("");
  const gesture = useRef<Gesture | null>(null);
  const alive = useRef(true);
  const statusRef = useRef<Status | null>(null);
  const stop = () => {
    const old = gesture.current; gesture.current = null;
    void fetch("/api/relay/command", {method: "POST", keepalive: true, headers: {"Content-Type": "application/json"},
      body: JSON.stringify({op: "stop", ...(old ? {gesture: old.id} : {})})}).catch(() => {});
    if (alive.current) setMessage("สั่งหยุดชุดจับแล้ว");
  };
  const renew = async (value: Gesture) => {
    if (value !== gesture.current || value.busy) return;
    value.busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch("/api/relay/command", {method: "POST", signal: controller.signal,
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({op: "move", gesture: value.id,
          floor: value.floor, target: value.target, counter: value.counter++})});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(gripperReason(data.error) || "คำสั่งเคลื่อนที่ถูกปฏิเสธ");
      }
    } catch (error) {
      if (gesture.current === value) {
        gesture.current = null;
        if (alive.current) setMessage(error instanceof Error ? error.message : "ยังยืนยันการรับคำสั่งไม่ได้ · ตรวจสถานะจาก ROS");
      }
    } finally { value.busy = false; clearTimeout(timeout); }
  };
  const move = (floor: GripperFloor, target: GripperTarget) => {
    const current = statusRef.current;
    if (!current?.ros_connected || !current.ready || !current.motion?.limits_fresh) {
      setMessage("รอบอร์ดรีเลย์และข้อมูลลิมิตให้พร้อมก่อน"); return;
    }
    if (current.motion.active || gesture.current?.busy) { setMessage("กดหยุดชุดจับก่อนเลือกจุดหมายใหม่"); return; }
    if (floor === 1 && target === "left" && current.ignored_limits?.includes(3)) {
      setMessage("ลิมิตซ้ายชั้น 1 ถูกข้าม จึงยังสั่งไปซ้ายสุดไม่ได้"); return;
    }
    if (target === "center" && !current.motion.inductive_ready[String(floor)]) {
      setMessage("ข้อมูลอินดักทีฟของชั้นนี้ยังไม่พร้อม"); return;
    }
    const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
    const value: Gesture = {id: Array.from(bytes, byte => byte.toString(16).padStart(2,"0")).join(""),
      floor, target, counter: 0, busy: false};
    gesture.current = value;
    setMessage(`ส่งคำสั่งชั้น ${floor} ไป${target === "left" ? "ซ้าย" : target === "right" ? "ขวา" : "ตรงกลาง"}`);
    void renew(value);
  };
  useEffect(() => {
    alive.current = true;
    let stopped = false;
    const unsubscribe = subscribeJson<Status>("/api/relay/state",value=>{
      if(stopped)return;
        statusRef.current = value; setStatus(value);
        setPositions(old => {
          const next = {...old};
          for (const floor of [1,2,3] as const) {
            const received = value.grippers?.[String(floor)];
            if (received && Number.isFinite(received.position) && received.position >= 0 && received.position <= 1) {
              next[floor] = {...received, moving: !!value.ros_connected && !!value.ready && received.moving};
            } else next[floor] = {...old[floor], moving: false, known: false};
          }
          return next;
        });
        const active = gesture.current;
        if (active && value.motion?.gesture === active.id) {
          if (!value.motion.active) gesture.current = null;
          setMessage(gripperReason(value.motion.reason));
        }
    },()=>{
      if(!stopped){statusRef.current=null;setStatus(null);
        setPositions(old=>({...old,1:{...old[1],moving:false},2:{...old[2],moving:false},3:{...old[3],moving:false}}));
        setMessage("ERROR · ติดต่อ ROS ไม่ได้ · กำลังรอสถานะกลับมา");}
    },100,800);
    return ()=>{stopped=true;alive.current=false;unsubscribe();};
  }, []);
  return {positions, move, stop, status, message, setMessage,
    moving: !!gesture.current || !!status?.motion?.active || Object.values(positions).some(value => value.moving),
    runStatus: !status?.ros_connected || !status.ready || !status.motion?.limits_fresh ? "ERROR" : status.motion?.status ?? "IDLE",
    ready: !!status?.ros_connected && !!status.ready && !!status.motion?.limits_fresh,
    ignoredLimits: status?.ignored_limits ?? []};
}
