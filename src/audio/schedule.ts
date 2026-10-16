// 재생 시간 계산 — 순수 함수 (테스트 대상)

export interface ScheduledNote {
  index: number;
  midi: number;
  /** 재생 시작 기준 초 */
  start: number;
  duration: number;
}

export interface SequenceOptions {
  /** "seq": 차례로, "chord": 동시에 */
  mode?: "seq" | "chord";
  /** 한 박 빠르기 (기본 72) */
  bpm?: number;
  /** 음마다 박 수 (숫자 하나면 모두 같음) */
  beats?: number | number[];
  /** 소리 길이 / 박 길이 (기본 0.95 — 음 사이를 살짝 띄움) */
  gate?: number;
}

export function scheduleSequence(midis: number[], opts: SequenceOptions = {}): { notes: ScheduledNote[]; total: number } {
  const beat = 60 / (opts.bpm ?? 72);
  const gate = opts.gate ?? 0.95;
  const beatsOf = (i: number) => (Array.isArray(opts.beats) ? opts.beats[i] ?? 1 : opts.beats ?? 1);

  if (opts.mode === "chord") {
    const duration = beatsOf(0) * beat;
    return {
      notes: midis.map((midi, index) => ({ index, midi, start: 0, duration: duration * gate })),
      total: duration,
    };
  }

  let t = 0;
  const notes = midis.map((midi, index) => {
    const len = beatsOf(index) * beat;
    const n = { index, midi, start: t, duration: len * gate };
    t += len;
    return n;
  });
  return { notes, total: t };
}
