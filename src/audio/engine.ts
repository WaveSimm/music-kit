// 오디오 엔진 — 브라우저 전용 싱글턴. AudioContext 하나를 앱 전체가 함께 쓴다.
// iOS Safari: AudioContext는 사용자 터치 안에서 unlock()해야 소리가 난다.
import { scheduleSequence, type SequenceOptions } from "./schedule";
import { SoundFontSource, type VoiceSource } from "./sources";

export type EngineStatus = "locked" | "running" | "error";

export interface Voice {
  stop(): void;
}

export interface Playback {
  stop(): void;
  /** 끝나거나 멈추면 resolve */
  done: Promise<void>;
}

const RELEASE = 0.12; // 음을 끊을 때 줄어드는 시간(초)

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private listeners = new Set<(s: EngineStatus) => void>();
  private _status: EngineStatus = "locked";
  private capturing = false;
  source: VoiceSource;

  constructor(source: VoiceSource = new SoundFontSource()) {
    this.source = source;
  }

  get status(): EngineStatus {
    return this._status;
  }

  onStatus(fn: (s: EngineStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: EngineStatus) {
    this._status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "interactive" });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    const master = ctx.createGain();
    master.gain.value = 1.4;
    master.connect(comp).connect(ctx.destination);
    ctx.onstatechange = () => this.setStatus(ctx.state === "running" ? "running" : "locked");
    this.ctx = ctx;
    this.master = master;
    return ctx;
  }

  /** 엔진의 AudioContext (없으면 만든다). 마이크 입력처럼 같은 시계를 써야 하는 곳에서 쓴다. */
  audioContext(): AudioContext {
    return this.ensureContext();
  }

  // iOS 17+ 오디오 세션: 평소에는 무음 스위치가 켜져 있어도 소리가 나도록 "playback",
  // 마이크를 쓰는 동안에는 "play-and-record" (지원하는 브라우저만)
  private applySession() {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    const type = this.capturing ? "play-and-record" : "playback";
    if (session && session.type !== type) session.type = type;
  }

  /** 마이크를 열기 전에 true, 닫은 뒤 false */
  setCapturing(on: boolean): void {
    this.capturing = on;
    try {
      this.applySession();
    } catch (e) {
      console.warn("[music-kit/audio]", e);
    }
  }

  /** 사용자 터치·클릭 핸들러 안에서 부른다. 두 번째부터는 아무 일도 하지 않는다. */
  async unlock(): Promise<void> {
    try {
      this.applySession();
      const ctx = this.ensureContext();
      if (ctx.state !== "running") await ctx.resume();
      this.setStatus(ctx.state === "running" ? "running" : "locked");
    } catch (e) {
      this.setStatus("error");
      throw e;
    }
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /**
   * 첫 터치 전에도 부를 수 있다: 파일만 받아 두고, 디코딩은 unlock 뒤에.
   * source를 주면 그 소리로(기본은 엔진 소리), lyrics[i]는 i번째 음의 음절.
   */
  preload(midis: number[], opts: { source?: VoiceSource; lyrics?: string[] } = {}): Promise<void> {
    const source = opts.source ?? this.source;
    if (!this.ctx) {
      midis.forEach((m, i) => source.prefetch(m, opts.lyrics?.[i]));
      return Promise.resolve();
    }
    const ctx = this.ctx;
    return Promise.all(midis.map((m, i) => source.load(ctx, m, opts.lyrics?.[i]).catch(() => undefined))).then(() => undefined);
  }

  /**
   * 한 음. when은 AudioContext 시각(생략하면 바로). 샘플이 아직 없으면 받는 대로 울린다.
   * source를 주면 그 소리로(기본은 엔진 소리), lyric은 노래 소리에서 부를 음절.
   */
  playNote(
    midi: number,
    opts: { when?: number; duration?: number; gain?: number; source?: VoiceSource; lyric?: string } = {},
  ): Voice {
    const ctx = this.ensureContext();
    let src: AudioBufferSourceNode | null = null;
    let env: GainNode | null = null;
    let stopped = false;
    const duration = opts.duration ?? 1.5;

    void (opts.source ?? this.source).load(ctx, midi, opts.lyric).then((buffer) => {
      if (stopped || !this.master) return;
      const start = Math.max(opts.when ?? 0, ctx.currentTime);
      src = ctx.createBufferSource();
      src.buffer = buffer;
      env = ctx.createGain();
      env.gain.value = opts.gain ?? 1;
      src.connect(env).connect(this.master);
      const end = start + duration;
      env.gain.setValueAtTime(opts.gain ?? 1, end);
      env.gain.setTargetAtTime(0, end, RELEASE / 3);
      src.start(start);
      src.stop(end + RELEASE * 2);
      const node = src;
      this.active.add(node);
      node.onended = () => this.active.delete(node);
    }).catch((e) => console.warn("[music-kit/audio]", e));

    return {
      stop: () => {
        stopped = true;
        if (src && env) {
          const now = ctx.currentTime;
          env.gain.cancelScheduledValues(now);
          env.gain.setTargetAtTime(0, now, RELEASE / 3);
          try { src.stop(now + RELEASE * 2); } catch { /* 이미 멈춤 */ }
        }
      },
    };
  }

  /**
   * 여러 음을 차례로(seq) 또는 동시에(chord). 샘플을 모두 받은 뒤 정확한 시각에 예약한다.
   * onNote(i)는 i번째 음이 울릴 때 불린다 (화면 강조용). source·lyrics는 preload와 같다.
   */
  playSequence(
    midis: number[],
    opts: SequenceOptions & { onNote?: (index: number) => void; source?: VoiceSource; lyrics?: string[] } = {},
  ): Playback {
    const ctx = this.ensureContext();
    const voices: Voice[] = [];
    let cancelled = false;
    let finish: () => void = () => {};
    const done = new Promise<void>((resolve) => (finish = resolve));

    void this.preload(midis, { source: opts.source, lyrics: opts.lyrics }).then(() => {
      if (cancelled) return finish();
      const { notes, total } = scheduleSequence(midis, opts);
      const t0 = ctx.currentTime + 0.05;
      for (const n of notes) {
        voices.push(this.playNote(n.midi, {
          when: t0 + n.start,
          duration: n.duration,
          source: opts.source,
          lyric: opts.lyrics?.[n.index],
        }));
        if (opts.onNote) this.later(() => !cancelled && opts.onNote?.(n.index), (t0 + n.start - ctx.currentTime) * 1000);
      }
      this.later(finish, (t0 + total - ctx.currentTime) * 1000);
    });

    return {
      stop: () => {
        cancelled = true;
        voices.forEach((v) => v.stop());
        finish();
      },
      done,
    };
  }

  /** 으뜸음 드론 — 피아노는 소리가 사라지므로 부드러운 신스음으로 계속 울린다 */
  startDrone(midi: number, opts: { gain?: number } = {}): Voice {
    const ctx = this.ensureContext();
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    const oscs = [
      { type: "triangle" as OscillatorType, f: freq, g: 1 },
      { type: "sine" as OscillatorType, f: freq * 2, g: 0.25 },
      { type: "sine" as OscillatorType, f: freq / 2, g: 0.35 },
    ].map(({ type, f, g }) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gn = ctx.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(filter);
      o.start();
      this.active.add(o);
      return o;
    });
    filter.connect(out).connect(this.master!);
    const now = ctx.currentTime;
    out.gain.setTargetAtTime(opts.gain ?? 0.12, now, 0.15);
    return {
      stop: () => {
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0, t, 0.1);
        oscs.forEach((o) => {
          try { o.stop(t + 0.6); } catch { /* 이미 멈춤 */ }
          o.onended = () => this.active.delete(o);
        });
      },
    };
  }

  /** 박자 소리 (짧은 딸깍). accent면 더 높고 크게 — 셈 들어가기·메트로놈용 */
  playClick(when?: number, opts: { accent?: boolean; gain?: number } = {}): void {
    const ctx = this.ensureContext();
    const t = Math.max(when ?? 0, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.frequency.value = opts.accent ? 1760 : 1320;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(opts.gain ?? (opts.accent ? 0.5 : 0.35), t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(env).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.08);
    this.active.add(osc);
    osc.onended = () => this.active.delete(osc);
  }

  /** 울리는 소리와 예약을 모두 멈춘다 */
  stopAll(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    const now = this.ctx?.currentTime ?? 0;
    this.active.forEach((n) => {
      try { n.stop(now + 0.05); } catch { /* 이미 멈춤 */ }
    });
    this.active.clear();
  }

  private later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, Math.max(0, ms));
    this.timers.add(id);
  }
}

let shared: AudioEngine | null = null;

/** 앱 전체가 함께 쓰는 엔진 (브라우저에서만 호출) */
export function getAudioEngine(): AudioEngine {
  if (typeof window === "undefined") throw new Error("오디오 엔진은 브라우저에서만 쓸 수 있습니다");
  shared ??= new AudioEngine();
  return shared;
}
