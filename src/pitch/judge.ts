// 부른 음 판정 — 순수 함수. 음높이 기록(시각·Hz)을 목표 음표 구간에 맞춰 음표마다 맞음·높음·낮음을 가린다.
import { freqToMidi } from "../theory/notes";

export interface PitchPoint {
  /** 초 (목표 음표 구간과 같은 시계) */
  t: number;
  /** 음높이가 잡히지 않았으면 null */
  hz: number | null;
}

export interface TargetNote {
  midi: number;
  /** 이 음을 부를 구간 (초) */
  start: number;
  end: number;
}

/** ok 맞음 · octave 음은 맞고 옥타브만 다름 · high 높음 · low 낮음 · missing 소리 없음 */
export type Verdict = "ok" | "octave" | "high" | "low" | "missing";

export interface NoteJudgement {
  midi: number;
  verdict: Verdict;
  /** 목표음과의 차이(센트, 중앙값). octave면 옥타브를 뺀 나머지. missing이면 null */
  cents: number | null;
  /** 옥타브 차이 (+1 = 한 옥타브 위로 부름) */
  octave: number;
  /** 판정 구간에서 음높이가 잡힌 비율 0~1 */
  voiced: number;
}

export interface JudgeOptions {
  /** 이 안이면 맞음 (센트, 기본 50) */
  tolerance?: number;
  /** 부르는 사람이 늦게 들어가는 시간 + 소리 지연 (초, 기본 0.1). 판정 구간을 이만큼 뒤로 민다 */
  lag?: number;
  /** 음표 구간 중 판정에 쓰는 부분 (비율, 기본 0.3~0.95) — 음을 찾아가는 앞부분은 뺀다 */
  from?: number;
  to?: number;
  /** 판정 구간에서 음높이가 잡힌 비율이 이보다 낮으면 소리 없음 (기본 0.3) */
  minVoiced?: number;
}

export interface SingJudgement {
  notes: NoteJudgement[];
  /** 맞은 음(옥타브만 다른 음 포함) 비율 0~1 */
  accuracy: number;
}

/** hz가 midi보다 몇 센트 높은지 (낮으면 음수) */
export function centsFrom(hz: number, midi: number): number {
  return (freqToMidi(hz) - midi) * 100;
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 한 음표: 판정 구간의 음높이 중앙값으로 가린다 (잠깐 튀는 값·검출 옥타브 오류에 흔들리지 않게) */
export function judgeNote(points: PitchPoint[], target: TargetNote, opts: JudgeOptions = {}): NoteJudgement {
  const { tolerance = 50, lag = 0.1, from = 0.3, to = 0.95, minVoiced = 0.3 } = opts;
  const len = target.end - target.start;
  const a = target.start + lag + len * from;
  const b = target.start + lag + len * to;
  const inWindow = points.filter((p) => p.t >= a && p.t <= b);
  const cents = inWindow.flatMap((p) => (p.hz ? [centsFrom(p.hz, target.midi)] : []));
  const voiced = inWindow.length ? cents.length / inWindow.length : 0;
  if (!cents.length || voiced < minVoiced) return { midi: target.midi, verdict: "missing", cents: null, octave: 0, voiced };

  const m = median(cents);
  const octave = Math.round(m / 1200);
  const rest = m - octave * 1200;
  if (octave !== 0 && Math.abs(rest) <= tolerance) return { midi: target.midi, verdict: "octave", cents: rest, octave, voiced };
  const verdict = Math.abs(m) <= tolerance ? "ok" : m > 0 ? "high" : "low";
  return { midi: target.midi, verdict, cents: m, octave: 0, voiced };
}

export function judgeSing(points: PitchPoint[], targets: TargetNote[], opts: JudgeOptions = {}): SingJudgement {
  const notes = targets.map((t) => judgeNote(points, t, opts));
  const good = notes.filter((n) => n.verdict === "ok" || n.verdict === "octave").length;
  return { notes, accuracy: notes.length ? good / notes.length : 0 };
}
