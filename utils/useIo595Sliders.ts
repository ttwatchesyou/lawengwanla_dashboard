import { subscribeJson, startVisiblePolling } from "./readPolling";
import { useEffect, useRef, useState } from "react";
import { Io595State, io595Live, io595SensorsLive, parseIo595 } from "./io595";
import { SliderFloor, SliderTarget, SLIDER_VALUE, sliderCommandAllowed, frontCommandAllowed } from "./io595Slider";

export default function useIo595Sliders() {
  const received = useRef<{ state: Io595State; at: number } | null>(null);
  const [snapshot, setSnapshot] = useState<{ state: Io595State | null; elapsed: number }>({ state: null, elapsed: 0 });
  const [error, setError] = useState("");
  const [sending, setSending] = useState<SliderFloor | "front" | "stop" | null>(null);
  const busy = useRef(false);
  const owned = useRef(false);
  const mounted = useRef(true);
  const state = snapshot.state;
  const live = io595SensorsLive(state, snapshot.elapsed);
  const fresh = io595Live(state, snapshot.elapsed);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const refresh = () => {
      const value = received.current;
      setSnapshot({ state: value?.state ?? null, elapsed: value ? performance.now() - value.at : 0 });
    };
    const unsubscribe = subscribeJson<any>("/api/io595/state", (value, stamp) => {
      const next=parseIo595(value);
      if(!disposed){received.current=next?{state:next,at:stamp.requestedAt}:null;refresh();}
    },()=>{if(!disposed){received.current=null;refresh();}},80,800);
    const expiry = startVisiblePolling(refresh,200);
    // Navigation/hidden tabs stop motions started from this page.
    const leave = () => {
      if (!owned.current) return;
      owned.current = false;
      void fetch("/api/io595/command", { method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "stop" }) }).catch(() => {});
    };
    const hidden = () => { if (document.hidden) leave(); };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      disposed = true; mounted.current = false;
      unsubscribe(); expiry.stop();
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
      leave();
    };
  }, []);

  const move = async (floor: SliderFloor, target: SliderTarget) => {
    const current = received.current;
    if (busy.current || !current || !sliderCommandAllowed(current.state, performance.now() - current.at, floor, target)) return;
    busy.current = true; owned.current = true; setSending(floor); setError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch("/api/io595/command", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: `floor${floor}`, value: SLIDER_VALUE[target], stop_generation: current.state.stop_generation }) });
      if (!response.ok) throw new Error("บอร์ดไม่รับคำสั่ง · ตรวจการเชื่อมต่อและสถานะชุดจับ");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "ยังยืนยันการรับคำสั่งไม่ได้ · ตรวจสถานะชุดจับหรือกดหยุดทั้งหมด");
    } finally {
      clearTimeout(timeout); busy.current = false;
      if (mounted.current) setSending(null);
    }
  };
  const stop = async () => {
    // STOP remains available even while a movement request is in flight.
    owned.current = false; setSending("stop"); setError("");
    try {
      const response = await fetch("/api/io595/command", { method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "stop" }) });
      if (!response.ok) throw new Error("ส่งคำสั่งหยุดไม่ได้ · ตรวจการเชื่อมต่อ");
    } catch {
      if (mounted.current) setError("ยังยืนยันการหยุดไม่ได้ · ตรวจการเชื่อมต่อบอร์ด");
    } finally { if (mounted.current) setSending(null); }
  };
  const moveFront = async (target: "in" | "out") => {
    const current = received.current;
    if (busy.current || !current || !frontCommandAllowed(current.state, performance.now() - current.at)) return;
    busy.current = true; owned.current = true; setSending("front"); setError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch("/api/io595/command", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "front", value: target === "in" ? 1 : 3, stop_generation: current.state.stop_generation }) });
      if (!response.ok) throw new Error("บอร์ดไม่รับคำสั่งชุดเข้า–ออก · ตรวจสถานะไดรเวอร์");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "ยังยืนยันการรับคำสั่งไม่ได้ · ตรวจสถานะชุดเข้า–ออกหรือกดหยุดทั้งหมด");
    } finally {
      clearTimeout(timeout); busy.current = false;
      if (mounted.current) setSending(null);
    }
  };
  return { packet: live ? state!.packet : null, live, ready: fresh && !!state?.ready, sending, error, move, moveFront, stop,
    canMoveFront: sending === null && frontCommandAllowed(state, snapshot.elapsed),
    canMove: (floor: SliderFloor, target: SliderTarget) => sending === null && sliderCommandAllowed(state, snapshot.elapsed, floor, target) };
}
