import { subscribeJson } from "./readPolling";
import { useReadClock } from "./useReadClock";
import { useEffect, useRef, useState } from "react";
import { RackCell } from "./rackMission";
import { MainprogramState } from "./liveOdometry";
import { parsePickSetup, PickSetup, pickupMatches } from "./pickupPreposition";

export default function usePickupPreposition(picks: RackCell[], main: MainprogramState, mainFresh: boolean) {
  const [setup, setSetup] = useState<PickSetup | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const now = useReadClock(250,true);
  const blocked = useRef(false), sending = useRef(false);
  const queued = useRef<RackCell[] | null>(null);
  const generation = useRef<number>();
  const live = useRef(true);
  const running = ["RUN", "STOPPING"].includes(main.status) || main.start_pending === true;
  const accept = (data: any, requestedAt = Date.now()) => {
    if (!live.current) return;
    const next = parsePickSetup(data.pick_setup);
    setSetup(next); setAt(requestedAt);
    generation.current = data.stop_generation;
    if (next?.locked) { blocked.current = true; setLocked(true); queued.current = null; }
  };
  const request = async (action: string, targets?: RackCell[]) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch("/api/io595/pick", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, picks: targets, stop_generation: generation.current }), signal: controller.signal });
      const data = await response.json();
      if (data.code === "MISSION_RUNNING") { blocked.current = true; setLocked(true); queued.current = null; }
      if (!response.ok) throw new Error(data.error || data.detail || "บอร์ดยังไม่พร้อมรับคำสั่งชุดจับ");
      accept(data); return data;
    } finally { clearTimeout(timeout); }
  };
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; queued.current = null; };
  }, []);
  useEffect(() => {
    if (!running) return;
    const already = blocked.current;
    blocked.current = true; setLocked(true); queued.current = null;
    if (!already) void request("freeze").catch(() => setError("ยืนยันการล็อกชุดจับไม่ได้"));
  }, [running]);
  useEffect(() => {
    if (locked || running) return;
    return subscribeJson<any>("/api/io595/state", (data,stamp)=>accept(data,stamp.wallRequestedAt),
      ()=>{setSetup(null);generation.current=undefined;},400,800);
  }, [locked, running]);
  const prepare = async (targets: RackCell[]) => {
    if (blocked.current || running) return;
    queued.current = targets;
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      while (queued.current && !blocked.current) {
        const next = queued.current; queued.current = null;
        await request("prepare", next);
      }
    } catch (cause) {
      queued.current = null;
      setError(cause instanceof Error ? cause.message : "ส่งคำสั่งไม่ได้ · กดจัดชุดจับเพื่อลองใหม่");
    } finally { sending.current = false; if (live.current) setBusy(false); }
  };
  const prepared = !busy && !locked && !running && now - at < 1500 && !!setup?.ready && pickupMatches(setup, picks);
  const lockBeforeStart = async () => {
    if (!prepared || sending.current || queued.current || blocked.current) throw new Error("รอชุดจับถึงตำแหน่งก่อนเริ่มภารกิจ");
    blocked.current = true; setLocked(true); queued.current = null;
    // Keep locked if a response is lost: the command may already have reached the gateway.
    await request("lock", picks);
  };
  const canReset = locked && !running && mainFresh && !!main.ready;
  const reset = async () => {
    if (!canReset || sending.current) return;
    setError("");
    try { await request("reset"); blocked.current = false; setLocked(false); setSetup(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ยังเตรียมรอบใหม่ไม่ได้"); }
  };
  return { locked: locked || running, busy, error, prepared, prepare, lockBeforeStart, reset, canReset };
}
