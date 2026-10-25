import { useEffect, useState } from "react";
import { startVisiblePolling } from "./readPolling";

// Freshness clocks are display-only. They catch up immediately after visibility resumes.
export function useReadClock(intervalMs = 200, wallClock = false) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const clock = startVisiblePolling(() => { setNow(wallClock ? Date.now() : performance.now()); }, intervalMs);
    return () => clock.stop();
  }, [intervalMs, wallClock]);
  return now;
}
