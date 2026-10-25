import { useEffect, useState } from "react";

export type GripperFloor = 1 | 2 | 3;
type GripperAxis = GripperFloor | "front";
export type GripperMotion = { position: number; target: number; moving: boolean; known?: boolean; estimated?: boolean };
export type GripperPositions = Record<GripperAxis, GripperMotion>;
export const GRIPPER_TARGETS = [
  { floor: 3, position: 0 }, { floor: 2, position: 0 }, { floor: 1, position: 0 },
  { floor: 3, position: 1 }, { floor: 2, position: 1 }, { floor: 1, position: 1 },
] as const;

const initialPositions = (): GripperPositions => ({
  1: { position: 0.5, target: 0.5, moving: false },
  2: { position: 0.5, target: 0.5, moving: false },
  3: { position: 0.5, target: 0.5, moving: false },
  front: { position: 0.5, target: 0.5, moving: false },
});

// Browser-only preview. No command transport or sensor writes belong in this hook.
export default function useGripperSimulation() {
  const [positions, setPositions] = useState<GripperPositions>(initialPositions);
  const moving = Object.values(positions).some(value => value.moving);

  useEffect(() => {
    if (!moving) return;
    let frame: number;
    let previous = performance.now();
    const tick = (now: number) => {
      // Keep a background tab from jumping across an entire rail on resume.
      const step = Math.min(Math.max((now - previous) / 1000, 0), 0.1) / 3.2;
      previous = now;
      setPositions(current => {
        const next = { ...current };
        for (const floor of [1, 2, 3, "front"] as const) {
          const value = current[floor];
          if (!value.moving) continue;
          const remaining = value.target - value.position;
          const arrived = Math.abs(remaining) <= step;
          next[floor] = {
            position: arrived ? value.target : value.position + Math.sign(remaining) * step,
            target: value.target,
            moving: !arrived,
          };
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving]);

  const moveTo = (destination: { floor: GripperAxis; position: number } | undefined) => {
    if (!destination) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPositions(current => {
      const value = current[destination.floor];
      return { ...current, [destination.floor]: {
        position: reduceMotion ? destination.position : value.position,
        target: destination.position,
        moving: !reduceMotion && value.position !== destination.position,
      } };
    });
  };

  const stop = () => setPositions(current => {
    const stopped = { ...current };
    for (const floor of [1, 2, 3, "front"] as const) {
      stopped[floor] = { ...current[floor], target: current[floor].position, moving: false };
    }
    return stopped;
  });

  const moveToLimit = (index: number) => {
    if (index === 7 || index === 8) moveTo({floor: "front", position: index === 7 ? 0 : 1});
    else moveTo(GRIPPER_TARGETS[index]);
  };
  const moveToInductive = (index: number) => {
    if (index >= 0 && index <= 2) moveTo({floor: (index + 1) as GripperFloor, position: 0.5});
    else if (index === 3) moveTo({floor: "front", position: 0.5});
  };
  return { positions, moving, moveToLimit, moveToInductive, stop, reset: () => setPositions(initialPositions()) };
}
