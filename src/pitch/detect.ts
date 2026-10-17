// 음높이 검출 — 짧은 소리 조각(보통 2048 샘플)의 기본주파수. McLeod 방법(pitchy).
// 브라우저 없이도 돌아간다 (테스트는 합성한 소리로).
import { PitchDetector } from "pitchy";

export interface PitchReading {
  /** 기본주파수(Hz). 소리가 작거나, 음높이가 또렷하지 않거나, 목소리 범위 밖이면 null */
  hz: number | null;
  /** 또렷함 0~1 (MPM clarity) */
  clarity: number;
  /** 소리 크기 (RMS, 0~1) */
  rms: number;
}

export interface DetectOptions {
  /** 이보다 또렷하지 않으면 음높이 없음 (기본 0.9) */
  minClarity?: number;
  /** 이보다 작은 소리는 무시 (RMS, 기본 0.01 ≈ -40dBFS) */
  minRms?: number;
  /** 사람 목소리 범위 밖은 무시 (기본 60~1500Hz) */
  minHz?: number;
  maxHz?: number;
}

/** size 샘플짜리 조각의 음높이를 재는 함수. 내부 버퍼를 재사용하므로 조각 길이는 늘 size여야 한다. */
export function createPitchDetector(size: number, opts: DetectOptions = {}) {
  const { minClarity = 0.9, minRms = 0.01, minHz = 60, maxHz = 1500 } = opts;
  const detector = PitchDetector.forFloat32Array(size);
  return (samples: Float32Array, sampleRate: number): PitchReading => {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    if (rms < minRms) return { hz: null, clarity: 0, rms };
    const [hz, clarity] = detector.findPitch(samples, sampleRate);
    const ok = clarity >= minClarity && hz >= minHz && hz <= maxHz;
    return { hz: ok ? hz : null, clarity, rms };
  };
}
