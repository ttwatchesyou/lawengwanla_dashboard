export type RenderEnvironment = {
  now: () => number; hidden: () => boolean;
  setTimer: (callback: () => void, delay: number) => any;
  clearTimer: (timer: any) => void;
  frame: (callback: () => void) => any; cancelFrame: (frame: any) => void;
  onVisibility: (callback: () => void) => () => void;
};
export function createDemandRenderer(draw: () => void, fps = 20, environment?: RenderEnvironment) {
  const env: RenderEnvironment = environment ?? {
    now: () => performance.now(), hidden: () => document.hidden,
    setTimer: (callback, delay) => setTimeout(callback, delay), clearTimer: id => clearTimeout(id),
    frame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id),
    onVisibility: callback => {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },
  };
  let timer: any = null, frame: any = null, last = -Infinity;
  let dirty = false, stopped = false, visible = true;
  const cancel = () => {
    if (timer !== null) env.clearTimer(timer);
    if (frame !== null) env.cancelFrame(frame);
    timer = frame = null;
  };
  const invalidate = () => {
    dirty = true;
    if (stopped || !visible || env.hidden() || timer !== null || frame !== null) return;
    timer = env.setTimer(() => {
      timer = null;
      frame = env.frame(() => {
        frame = null;
        if (stopped || !visible || env.hidden() || !dirty) return;
        dirty = false; last = env.now(); draw();
      });
    }, Math.max(0, 1000 / fps - (env.now() - last)));
  };
  const removeVisibility = env.onVisibility(() => {
    if (env.hidden()) cancel(); else invalidate();
  });
  return {
    invalidate,
    setVisible: (next: boolean) => { visible = next; if (next) invalidate(); else cancel(); },
    stop: () => { stopped = true; cancel(); removeVisibility(); },
  };
}
