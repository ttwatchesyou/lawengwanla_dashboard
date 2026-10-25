import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MazeCell } from "./mazeRoute";
import { WaypointSettingsMap } from "./waypointSettings";
import { ExecutionSettings } from "./mainprogramSettings";
import { LiveOdometry } from "./useLiveOdometry";
import { sampleSimulation } from "./robotSimulation";
import { liveTurboFrame, SILENT_TURBO, TurboAudio } from "./turboAudio";
import { makeTurboSimulation, simulationTurboFrame } from "./turboSimulation";

export default function useMazeTurbo(
  route: MazeCell[],
  settings: WaypointSettingsMap,
  config: ExecutionSettings,
  live: LiveOdometry
) {
  const audio = useRef<TurboAudio | null>(null);
  const [enabled, setEnabled] = useState(true),
    [volume, setVolume] = useState(0.3);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState<number | null>(null);
  const plan = useMemo(
    () => makeTurboSimulation(route, settings, config),
    [route, settings, config]
  );
  const busy = ["RUN", "STOPPING"].includes(live.state.status);
  const current = useRef({ enabled, volume, live, playing, plan, time });
  current.current = { enabled, volume, live, playing, plan, time };
  const arm = useCallback(() => {
    if (!current.current.enabled) return;
    if (!audio.current) audio.current = new TurboAudio();
    void audio.current
      .arm()
      .then(() => setError(""))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "เปิดเสียงไม่ได้")
      );
  }, []);
  const stop = useCallback(() => {
    setPlaying(false);
    setTime(null);
    audio.current?.silence();
  }, []);
  const onRun = useCallback(() => {
    stop();
    arm();
  }, [stop, arm]);
  const startSimulation = () => {
    if (busy || !plan.valid || !plan.duration) return;
    arm();
    setTime(0);
    setPlaying(true);
  };
  const toggle = () => {
    audio.current?.silence();
    setEnabled((value) => !value);
    if (!enabled) {
      current.current.enabled = true;
      arm();
    }
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("maze-turbo-audio-v1") || "null"
      );
      if (typeof saved?.enabled === "boolean") setEnabled(saved.enabled);
      if (typeof saved?.volume === "number" && Number.isFinite(saved.volume))
        setVolume(Math.min(1, Math.max(0, saved.volume)));
    } catch {}
  }, []);
  const save = (nextEnabled: boolean, nextVolume: number) => {
    try {
      localStorage.setItem(
        "maze-turbo-audio-v1",
        JSON.stringify({ enabled: nextEnabled, volume: nextVolume })
      );
    } catch {}
  };
  useEffect(() => {
    stop();
  }, [plan, stop]);
  useEffect(() => {
    if (busy && current.current.playing) stop();
  }, [busy, stop]);
  useEffect(() => {
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(),
        delta = Math.min(0.15, (now - previous) / 1000);
      previous = now;
      const c = current.current;
      if (document.hidden) {
        audio.current?.silence();
        return;
      }
      let frame = SILENT_TURBO;
      if (
        c.time !== null &&
        !["RUN", "STOPPING"].includes(c.live.state.status)
      ) {
        const next = Math.min(
          c.plan.duration,
          c.time + (c.playing ? delta : 0)
        );
        current.current.time = next;
        setTime(next);
        if (next >= c.plan.duration) setPlaying(false);
        frame = simulationTurboFrame(c.plan, next);
      } else frame = liveTurboFrame(c.live.state, c.live.fresh);
      audio.current?.setVolume(c.volume);
      audio.current?.update(c.enabled ? frame : SILENT_TURBO);
    }, 50);
    const silence = () => audio.current?.silence();
    document.addEventListener("visibilitychange", silence);
    window.addEventListener("pagehide", silence);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", silence);
      window.removeEventListener("pagehide", silence);
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  return {
    enabled,
    volume,
    error,
    playing,
    time,
    plan,
    busy,
    onRun,
    startSimulation,
    stop,
    simulation: time === null ? null : sampleSimulation(plan, time),
    toggle: () => {
      toggle();
      save(!enabled, volume);
    },
    changeVolume: (value: number) => {
      setVolume(value);
      save(enabled, value);
      arm();
    },
  };
}
export type MazeTurbo = ReturnType<typeof useMazeTurbo>;
