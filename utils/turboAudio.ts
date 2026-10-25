import { MainprogramState, finiteVector } from "./liveOdometry";

export type TurboFrame = {
  moving: boolean;
  distance: number;
  speed: number;
  ending?: boolean;
};
export const SILENT_TURBO: TurboFrame = {
  moving: false,
  distance: 0,
  speed: 0,
};

export const FINISHED_TURBO: TurboFrame = { ...SILENT_TURBO, ending: true };

// Target and pose share the controller's odometry frame. distance_m is the
// total mission length, not distance to the current motion target.
export function liveTurboFrame(
  state: MainprogramState,
  fresh: boolean
): TurboFrame {
  const target = state.target;
  if (!fresh) return SILENT_TURBO;
  if (
    state.status === "FINISH" ||
    (state.status === "STOPPING" &&
      state.reason === "Route reached; confirming stop")
  )
    return FINISHED_TURBO;
  if (
    state.status !== "RUN" ||
    state.position_holding ||
    !finiteVector(state.pose) ||
    !finiteVector(state.twist_world) ||
    !Number.isFinite(target?.x) ||
    !Number.isFinite(target?.y)
  )
    return SILENT_TURBO;
  const speed = Math.hypot(state.twist_world[0], state.twist_world[1]);
  return {
    moving: speed > 0.015,
    speed,
    distance: Math.max(
      0,
      Math.hypot(target!.x! - state.pose[0], target!.y! - state.pose[1]) -
        (target?.tolerance ?? 0.02)
    ),
  };
}

export function turboLoad(frame: TurboFrame) {
  if (
    !frame.moving ||
    !Number.isFinite(frame.distance) ||
    !Number.isFinite(frame.speed)
  )
    return 0;
  return (
    Math.min(1, Math.max(0, frame.speed) / 0.7) *
    Math.sqrt(Math.min(1, Math.max(0, frame.distance) / 0.65))
  );
}

// Ease off ahead of the controller's next stop/corner, independently of the
// instantaneous wheel speed. Simulation supplies the full straight-span distance.
export function engineVoicing(frame: TurboFrame) {
  const speed = Number.isFinite(frame.speed)
    ? Math.min(1, Math.max(0, frame.speed) / 0.7)
    : 0;
  const distance = Number.isFinite(frame.distance)
    ? Math.max(0, frame.distance)
    : 0;
  const t = Math.max(0, Math.min(1, (distance - 0.04) / 0.8));
  const throttle = t * t * (3 - 2 * t);
  const rate = 0.65 + (0.08 + speed * 0.9) * (0.12 + throttle * 0.88);
  return {
    rate,
    level: 0.1 + speed * 0.17 * (0.55 + throttle * 0.45),
    pulseHz: 7 + rate * 3,
    pulseDepth: 0.025 + (1 - throttle) * 0.105,
  };
}

// Reference-based synthesis: spool textures crossfade with rotor inertia; the
// recorded valve release has its own envelope, independent of the running bed.
// Asset origins, extraction ranges and licenses: /audio/turbo-v3/CREDITS.txt.
export class TurboDynamics {
  private spool = 0;
  private peak = 0;
  private charged = false;
  private lastTime: number | null = null;
  private lastRelease = -Infinity;
  private rechargeFloor = 0;

  step(frame: TurboFrame, now: number) {
    const target = turboLoad(frame);
    const dt =
      this.lastTime === null
        ? 0.05
        : Math.max(0, Math.min(0.2, now - this.lastTime));
    this.lastTime = now;
    this.spool +=
      (target - this.spool) *
      (1 - Math.exp(-dt / (target > this.spool ? 0.28 : 0.4)));
    if (!this.charged)
      this.rechargeFloor = Math.min(this.rechargeFloor, target);
    if (
      target > this.rechargeFloor + 0.08 &&
      target > 0.18 &&
      target >= this.spool * 0.95 &&
      now - this.lastRelease > 0.65
    )
      this.charged = true;
    if (this.charged) this.peak = Math.max(this.peak, this.spool);
    const release =
      this.charged &&
      this.peak > 0.16 &&
      (target < this.peak * 0.65 ||
        (frame.moving && frame.distance <= 0.5 && target < this.peak * 0.9)) &&
      now - this.lastRelease > 0.65
        ? this.peak
        : 0;
    if (release) {
      this.charged = false;
      this.peak = 0;
      this.lastRelease = now;
      this.rechargeFloor = target;
    }
    return { spool: this.spool, release };
  }

  reset() {
    this.spool = 0;
    this.peak = 0;
    this.charged = false;
    this.lastTime = null;
    this.lastRelease = -Infinity;
    this.rechargeFloor = 0;
  }
}

export class TurboAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volumeGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineLow: GainNode | null = null;
  private engineHigh: GainNode | null = null;
  private enginePulse: OscillatorNode | null = null;
  private enginePulseDepth: GainNode | null = null;
  private active = false;
  private ending = false;
  private releaseUntil = 0;
  private lowGain: GainNode | null = null;
  private highGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private loops: AudioBufferSourceNode[] = [];
  private releases = new Map<AudioBufferSourceNode, GainNode>();
  private valve: AudioBuffer | null = null;
  private pressureAir: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;
  private abort: AbortController | null = null;
  private dynamics = new TurboDynamics();
  private volume = 0.3;

  async arm() {
    if (!this.context) {
      const ctor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!ctor) throw Error("เบราว์เซอร์นี้ไม่รองรับเสียงเทอร์โบ");
      const ctx = (this.context = new ctor());
      const master = (this.master = ctx.createGain());
      master.gain.value = 0;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.16;
      this.volumeGain = ctx.createGain();
      this.volumeGain.gain.value = this.volume * 0.75;
      master.connect(this.volumeGain);
      this.volumeGain.connect(compressor);
      // Leave room for the stronger valve transient even at full volume.
      const headroom = ctx.createGain();
      headroom.gain.value = 0.25;
      const limiter = ctx.createWaveShaper();
      const curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++)
        curve[i] =
          0.95 * Math.tanh((((i / (curve.length - 1)) * 2 - 1) * 4) / 0.95);
      limiter.curve = curve;
      limiter.oversample = "2x";
      compressor.connect(headroom);
      headroom.connect(limiter);
      limiter.connect(ctx.destination);
      const filter = (this.filter = ctx.createBiquadFilter());
      filter.type = "lowpass";
      filter.Q.value = 0.65;
      filter.frequency.value = 7000;
      filter.connect(master);
      this.lowGain = ctx.createGain();
      this.highGain = ctx.createGain();
      this.lowGain.gain.value = 0;
      this.highGain.gain.value = 0;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineLow = ctx.createGain();
      this.engineHigh = ctx.createGain();
      this.engineLow.gain.value = 1;
      this.engineHigh.gain.value = 0;
      this.engineLow.connect(this.engineGain);
      this.engineHigh.connect(this.engineGain);
      const tremolo = ctx.createGain();
      tremolo.gain.value = 0.88;
      this.engineGain.connect(tremolo);
      tremolo.connect(master);
      this.enginePulse = ctx.createOscillator();
      this.enginePulse.type = "sine";
      this.enginePulse.frequency.value = 9;
      this.enginePulseDepth = ctx.createGain();
      this.enginePulseDepth.gain.value = 0.025;
      this.enginePulse.connect(this.enginePulseDepth);
      this.enginePulseDepth.connect(tremolo.gain);
      this.enginePulse.start();
      this.lowGain.connect(filter);
      this.highGain.connect(filter);
    }
    const ctx = this.context;
    // Resume during the click, before fetching/decoding, for autoplay policies.
    const resumed = ctx.resume();
    if (!this.loading) {
      this.abort = new AbortController();
      this.loading = this.load(ctx, this.abort.signal).catch((error) => {
        if (this.context === ctx) this.loading = null;
        throw error;
      });
    }
    await Promise.all([resumed, this.loading]);
    if (this.context !== ctx) return;
    if (ctx.state !== "running")
      throw Error("เปิดเสียงไม่ได้ กรุณากดเปิดเสียงอีกครั้ง");
  }

  private async load(ctx: AudioContext, signal: AbortSignal) {
    const buffers = await Promise.all(
      [
        "/audio/turbo-v3/spool-low.wav",
        "/audio/turbo-v3/spool-high.wav",
        "/audio/turbo-v3/blowoff.wav",
        "/audio/k24-hks-v1/engine-low.wav",
        "/audio/k24-hks-v1/engine-high.wav",
      ].map(async (url) => {
        const response = await fetch(url, {
          signal,
          cache: "force-cache",
        });
        if (!response.ok)
          throw Error("โหลดเสียงเทอร์โบไม่ได้ กรุณาลองเปิดเสียงอีกครั้ง");
        return ctx.decodeAudioData(await response.arrayBuffer());
      })
    );
    if (this.context !== ctx || signal.aborted) return;
    this.valve = buffers[2];
    this.pressureAir = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * 1.5),
      ctx.sampleRate
    );
    const air = this.pressureAir.getChannelData(0);
    // A quiet broadband pressure bed supports the recorded valve transient.
    for (let i = 0; i < air.length; i++) air[i] = Math.random() * 2 - 1;
    this.loops = [buffers[0], buffers[1], buffers[3], buffers[4]].map(
      (buffer, index) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.playbackRate.value = 0.8;
        source.connect(
          index === 0
            ? this.lowGain!
            : index === 1
            ? this.highGain!
            : index === 2
            ? this.engineLow!
            : this.engineHigh!
        );
        source.start();
        return source;
      }
    );
  }

  setVolume(volume: number) {
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0;
    if (this.context)
      this.volumeGain?.gain.setTargetAtTime(
        this.volume * 0.75,
        this.context.currentTime,
        0.02
      );
  }

  update(frame: TurboFrame) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    if (
      frame === SILENT_TURBO ||
      !Number.isFinite(frame.speed) ||
      !Number.isFinite(frame.distance)
    ) {
      this.silence();
      return;
    }
    const now = ctx.currentTime;
    if (frame.ending || !frame.moving) {
      this.finish(now);
      return;
    }
    if (this.ending) {
      for (const gain of [
        this.master,
        this.lowGain,
        this.highGain,
        this.engineGain,
      ])
        this.hold(gain?.gain, now);
      this.ending = false;
    }
    this.active = true;
    const { spool, release } = this.dynamics.step(frame, now);
    // Equal-power crossfade between real low/high boost recordings. Keep pitch
    // variation small: sweeping sine waves sounded like an electronic siren.
    const mix = Math.max(0, Math.min(1, (spool - 0.15) / 0.7));
    const level = 0.12 + Math.pow(spool, 0.85) * 0.95;
    this.master.gain.setTargetAtTime(1, now, 0.025);
    this.lowGain?.gain.setTargetAtTime(
      Math.cos((mix * Math.PI) / 2) * level,
      now,
      0.08
    );
    this.highGain?.gain.setTargetAtTime(
      Math.sin((mix * Math.PI) / 2) * level,
      now,
      0.08
    );
    const engine = engineVoicing(frame);
    this.engineGain?.gain.setTargetAtTime(engine.level * 1.45, now, 0.16);
    const engineMix = Math.max(0, Math.min(1, (engine.rate - 0.72) / 0.8));
    this.engineLow?.gain.setTargetAtTime(
      Math.cos((engineMix * Math.PI) / 2),
      now,
      0.12
    );
    this.engineHigh?.gain.setTargetAtTime(
      Math.sin((engineMix * Math.PI) / 2),
      now,
      0.12
    );
    this.enginePulse?.frequency.setTargetAtTime(engine.pulseHz, now, 0.18);
    this.enginePulseDepth?.gain.setTargetAtTime(engine.pulseDepth, now, 0.14);
    this.loops.forEach((loop, i) =>
      loop.playbackRate.setTargetAtTime(
        i >= 2 ? engine.rate : 0.78 + spool * (i ? 0.3 : 0.23),
        now,
        0.18
      )
    );
    this.filter?.frequency.setTargetAtTime(4400 + spool * 7600, now, 0.14);
    if (release) this.blowOff(release, now);
  }

  private hold(param: AudioParam | undefined, now: number) {
    if (!param) return;
    if (typeof param.cancelAndHoldAtTime === "function")
      param.cancelAndHoldAtTime(now);
    else {
      const value = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(value, now);
    }
  }

  private finish(now: number) {
    // Called repeatedly by idle/finished frames: schedule the tail once.
    if (!this.active || !this.context || !this.master) return;
    this.active = false;
    this.ending = true;
    const { release } = this.dynamics.step(FINISHED_TURBO, now);
    if (release) this.blowOff(release, now, false);
    this.dynamics.reset();
    for (const gain of [this.lowGain, this.highGain]) {
      this.hold(gain?.gain, now);
      gain?.gain.setTargetAtTime(0, now, 0.26);
      gain?.gain.setValueAtTime(0, now + 1.7);
    }
    this.hold(this.engineGain?.gain, now);
    this.engineGain?.gain.setTargetAtTime(0.075, now, 0.23);
    this.engineGain?.gain.setTargetAtTime(0, now + 0.65, 0.24);
    this.engineGain?.gain.setValueAtTime(0, now + 1.7);
    this.loops
      .slice(2)
      .forEach((loop) => loop.playbackRate.setTargetAtTime(0.65, now, 0.32));
    this.enginePulse?.frequency.setTargetAtTime(9, now, 0.25);
    this.enginePulseDepth?.gain.setTargetAtTime(0.08, now, 0.2);
    // Preserve the complete valve sample, then fade the whole mix to silence.
    const end = Math.max(now + 1.7, this.releaseUntil + 0.12);
    this.hold(this.master.gain, now);
    this.master.gain.setTargetAtTime(0, end - 0.2, 0.045);
    this.master.gain.setValueAtTime(0, end);
  }

  private blowOff(boost: number, now: number, corner = true) {
    if (corner) {
      // Six close pulses mimic pressure dying away, over a continuous bed.
      const strengths = [1, 0.76, 0.56, 0.4, 0.28, 0.18];
      strengths.forEach((strength, index) => {
        this.valveBurst(
          boost * Math.pow(0.82, index),
          now + index * 0.125,
          [0.14, 0.14, 0.13, 0.13, 0.12, 0.12][index],
          strength
        );
      });
    } else this.valveBurst(boost, now);
  }

  private valveBurst(
    boost: number,
    now: number,
    burstDuration?: number,
    strength = 1
  ) {
    const ctx = this.context;
    if (!ctx || !this.valve || !this.master) return;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = this.valve;
    source.playbackRate.value = 0.71 + boost * 0.08;
    // Normal final completion retains the full recorded tail.
    const duration =
      burstDuration ?? this.valve.duration / source.playbackRate.value;
    this.releaseUntil = Math.max(this.releaseUntil, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(
      (1.05 + boost * 0.95) * strength,
      now + 0.008
    );
    gain.gain.setValueAtTime(
      (1.05 + boost * 0.95) * strength,
      now + duration * 0.65
    );
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(gain);
    // Brighten the real valve whistle instead of adding a synthetic tone.
    const sheen = ctx.createBiquadFilter();
    sheen.type = "highshelf";
    sheen.frequency.value = 4500;
    sheen.gain.value = 2;
    gain.connect(sheen);
    sheen.connect(this.master);
    this.releases.set(source, gain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      sheen.disconnect();
      this.releases.delete(source);
    };
    // Start on the recorded air transient so short flutter pulses speak
    // immediately instead of losing their attack to the recording's lead-in.
    source.start(now, burstDuration === undefined ? 0 : 0.09);
    source.stop(now + duration + 0.01);
    this.ventAir(boost, now, burstDuration, strength);
  }

  private ventAir(
    boost: number,
    now: number,
    burstDuration?: number,
    strength = 1
  ) {
    const ctx = this.context;
    if (!ctx || !this.master || !this.pressureAir) return;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    const high = ctx.createBiquadFilter(),
      low = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 1200;
    high.Q.value = 0.5;
    low.type = "lowpass";
    low.frequency.value = 8500;
    low.Q.value = 0.5;
    source.buffer = this.pressureAir;
    const duration = burstDuration ?? 0.85 + boost * 0.35;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(
      (0.16 + boost * 0.2) * strength,
      now + 0.025
    );
    gain.gain.exponentialRampToValueAtTime(
      0.002 * strength,
      now + duration - 0.08
    );
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(high);
    high.connect(low);
    low.connect(gain);
    gain.connect(this.master);
    this.releases.set(source, gain);
    source.onended = () => {
      source.disconnect();
      high.disconnect();
      low.disconnect();
      gain.disconnect();
      this.releases.delete(source);
    };
    source.start(now);
    source.stop(now + duration + 0.01);
    this.releaseUntil = Math.max(this.releaseUntil, now + duration);
  }

  silence() {
    this.dynamics.reset();
    this.active = false;
    this.ending = false;
    this.releaseUntil = 0;
    if (this.context) {
      for (const node of [
        this.master,
        this.lowGain,
        this.highGain,
        this.engineGain,
      ]) {
        node?.gain.cancelScheduledValues(this.context.currentTime);
        node?.gain.setValueAtTime(0, this.context.currentTime);
      }
      this.releases.forEach((gain, source) => {
        source.stop(this.context!.currentTime);
        source.disconnect();
        gain.disconnect();
      });
      this.releases.clear();
    }
  }

  dispose() {
    this.silence();
    this.abort?.abort();
    this.enginePulse?.stop();
    this.enginePulse?.disconnect();
    this.enginePulseDepth?.disconnect();
    this.enginePulse = null;
    this.enginePulseDepth = null;
    this.loops.forEach((source) => {
      source.stop();
      source.disconnect();
    });
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.engineGain = null;
    this.engineLow = null;
    this.engineHigh = null;
    this.volumeGain = null;
    this.lowGain = null;
    this.highGain = null;
    this.filter = null;
    this.loops = [];
    this.valve = null;
    this.pressureAir = null;
    this.loading = null;
  }
}
