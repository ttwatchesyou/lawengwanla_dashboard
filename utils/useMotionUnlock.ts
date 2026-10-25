import { useEffect, useRef, useState } from "react";

// Operator intent is separate from live permission. START must still check ready
// on every render/click. Short feedback jitter must not flash/reset the checkbox.
export default function useMotionUnlock(ready: boolean, busy: boolean, identity: string) {
  const [unlocked, setUnlocked] = useState(false);
  const [available, setAvailable] = useState(ready && !busy);
  const previous = useRef(identity);
  useEffect(() => {
    if (previous.current !== identity) {
      previous.current = identity;
      setUnlocked(false);
    }
  }, [identity]);
  useEffect(() => {
    if (busy) { setUnlocked(false); setAvailable(false); return; }
    if (ready) { setAvailable(true); return; }
    // A persistent loss disarms once; recovery does not rearm the control.
    const timer = setTimeout(() => { setUnlocked(false); setAvailable(false); }, 1200);
    return () => clearTimeout(timer);
  }, [ready, busy]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setUnlocked(false); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  return [unlocked && previous.current === identity && !busy, setUnlocked, available && !busy] as const;
}
