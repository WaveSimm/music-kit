// 마이크 음높이 추적 — 브라우저 전용. getUserMedia → AnalyserNode → createPitchDetector를 일정 간격으로.
// 녹음(MediaRecorder)도 같은 마이크 스트림으로 한다. 소리는 기기 밖으로 보내지 않는다.
import { createPitchDetector, type DetectOptions, type PitchReading } from "./detect";

export interface PitchFrame extends PitchReading {
  /** AudioContext 시각(초) — 읽은 소리 조각의 가운데 */
  t: number;
}

/** insecure: https가 아닌 주소 · unsupported: 브라우저 미지원 · denied: 권한 거부 · not-found: 마이크 없음 · busy: 다른 앱이 사용 중 */
export type MicErrorKind = "insecure" | "unsupported" | "denied" | "not-found" | "busy" | "unknown";

export class MicError extends Error {
  constructor(readonly kind: MicErrorKind, message: string) {
    super(message);
    this.name = "MicError";
  }
}

/** 마이크를 쓸 수 없는 까닭 (써 볼 수 있으면 null) — 버튼을 누르기 전에 안내할 때 */
export function micUnavailableReason(): MicErrorKind | null {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  return null;
}

function toMicError(e: unknown): MicError {
  const name = (e as { name?: string })?.name;
  const msg = String((e as { message?: string })?.message ?? e);
  if (name === "NotAllowedError" || name === "SecurityError") return new MicError("denied", `마이크 권한이 없습니다 (${msg})`);
  if (name === "NotFoundError" || name === "OverconstrainedError") return new MicError("not-found", `마이크를 찾지 못했습니다 (${msg})`);
  if (name === "NotReadableError" || name === "AbortError") return new MicError("busy", `마이크를 열지 못했습니다 (${msg})`);
  return new MicError("unknown", `마이크를 켜지 못했습니다 (${msg})`);
}

export interface TrackerOptions {
  /** 읽는 간격 (기본 50ms) */
  intervalMs?: number;
  /** 한 번에 읽는 샘플 수 (기본 2048 — 48kHz에서 약 43ms, G2(98Hz)도 네 주기 넘게 들어간다) */
  fftSize?: number;
  detect?: DetectOptions;
  onFrame?: (frame: PitchFrame) => void;
}

/** 녹음 중인 소리. stop()은 녹음한 소리(Blob)를 돌려준다 — 브라우저가 녹음을 못 하면 null */
export interface MicRecording {
  stop(): Promise<Blob | null>;
}

export class PitchTracker {
  onFrame: ((frame: PitchFrame) => void) | undefined;
  private timer: ReturnType<typeof setInterval>;
  private nodes: AudioNode[];
  private stopped = false;

  private constructor(readonly ctx: AudioContext, readonly stream: MediaStream, opts: TrackerOptions) {
    const fftSize = opts.fftSize ?? 2048;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0;
    // 소리는 내지 않되(음량 0) 출력까지 이어 두어야 처리를 건너뛰지 않는 브라우저가 있다
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(analyser).connect(mute).connect(ctx.destination);
    this.nodes = [source, analyser, mute];

    const detect = createPitchDetector(fftSize, opts.detect);
    const buf = new Float32Array(fftSize);
    const half = fftSize / ctx.sampleRate / 2;
    this.onFrame = opts.onFrame;
    this.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      this.onFrame?.({ t: ctx.currentTime - half, ...detect(buf, ctx.sampleRate) });
    }, opts.intervalMs ?? 50);
  }

  /** 마이크를 열고 추적을 시작한다. 처음이면 브라우저가 권한을 묻는다. 실패하면 MicError. */
  static async open(ctx: AudioContext, opts: TrackerOptions = {}): Promise<PitchTracker> {
    const reason = micUnavailableReason();
    if (reason) throw new MicError(reason, reason === "insecure" ? "https 주소에서만 마이크를 쓸 수 있습니다" : "이 브라우저는 마이크를 지원하지 않습니다");
    let stream: MediaStream;
    try {
      // 음높이를 재야 하므로 통화용 처리(잡음 제거·자동 음량·메아리 제거)는 끈다
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
    } catch (e) {
      throw toMicError(e);
    }
    return new PitchTracker(ctx, stream, opts);
  }

  /** 같은 마이크로 녹음을 시작한다 */
  record(): MicRecording {
    if (typeof MediaRecorder === "undefined") return { stop: async () => null };
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
      rec.start();
    } catch (e) {
      console.warn("[music-kit/pitch] 녹음을 시작하지 못했습니다", e);
      return { stop: async () => null };
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const result = () => (chunks.length ? new Blob(chunks, { type: rec.mimeType || type }) : null);
    return {
      stop: () =>
        new Promise((resolve) => {
          if (rec.state === "inactive") return resolve(result());
          rec.onstop = () => resolve(result());
          rec.stop();
        }),
    };
  }

  /** 추적을 멈추고 마이크를 끈다 (브라우저의 마이크 표시도 꺼진다) */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    this.nodes.forEach((n) => n.disconnect());
    this.stream.getTracks().forEach((t) => t.stop());
  }
}
