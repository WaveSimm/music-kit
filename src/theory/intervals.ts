// 음정과 화음 이름 (용어: 장·단·완전·증·감, 장3화음·딸림7화음, 기본위치·1전위…)
import {
  formatPitchClass, letterSteps, midiToPitch, mod, pitchClassNumber, pitchToMidi, toPitch,
  type Pitch, type PitchClass,
} from "./notes";

const PERFECT_NUMBERS = new Set([1, 4, 5]);
/** 도수(1~7)별 기준 반음 수: 완전음정은 완전, 나머지는 장음정 */
const BASE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export interface Interval {
  /** 도수: 1(1도) 3(3도) 8(8도) 10(10도) … */
  number: number;
  quality: "완전" | "장" | "단" | "증" | "감" | "겹증" | "겹감";
  semitones: number;
  /** "장3도", "완전5도" */
  name: string;
}

/**
 * 철자로 계산한 음정 (낮은 음 → 높은 음 순서로 정렬해서 계산).
 * C4–E4 장3도, C4–Fb4 감4도, C4–G4 완전5도, C4–E5 장10도.
 */
export function interval(a: Pitch | string, b: Pitch | string): Interval {
  let lo = toPitch(a);
  let hi = toPitch(b);
  if (pitchToMidi(hi) < pitchToMidi(lo) || (pitchToMidi(hi) === pitchToMidi(lo) && letterSteps(lo, hi) < 0)) {
    [lo, hi] = [hi, lo];
  }
  const steps = letterSteps(lo, hi);
  const semitones = pitchToMidi(hi) - pitchToMidi(lo);
  const simple = mod(steps, 7);
  const diff = semitones - (BASE_SEMITONES[simple] + 12 * Math.floor(steps / 7));
  const number = steps + 1;
  const quality = PERFECT_NUMBERS.has(simple + 1) ? perfectQuality(diff) : majorQuality(diff);
  return { number, quality, semitones, name: `${quality}${number}도` };
}

function perfectQuality(diff: number): Interval["quality"] {
  const q = ({ [-2]: "겹감", [-1]: "감", 0: "완전", 1: "증", 2: "겹증" } as Record<number, Interval["quality"]>)[diff];
  if (!q) throw new Error(`이름 붙일 수 없는 음정입니다 (차이 ${diff})`);
  return q;
}

function majorQuality(diff: number): Interval["quality"] {
  const q = ({ [-3]: "겹감", [-2]: "감", [-1]: "단", 0: "장", 1: "증", 2: "겹증" } as Record<number, Interval["quality"]>)[diff];
  if (!q) throw new Error(`이름 붙일 수 없는 음정입니다 (차이 ${diff})`);
  return q;
}

export function intervalName(a: Pitch | string, b: Pitch | string): string {
  return interval(a, b).name;
}

/** 철자 없이 반음 수로 부르는 기본 이름 (듣고 맞히기 퀴즈용). 6반음은 증4도. */
const SEMITONE_NAMES = ["완전1도", "단2도", "장2도", "단3도", "장3도", "완전4도", "증4도", "완전5도", "단6도", "장6도", "단7도", "장7도", "완전8도"];

export function intervalNameBySemitones(semitones: number): string {
  const n = Math.abs(semitones);
  if (n > 12) throw new Error("한 옥타브를 넘는 음정은 철자로 계산하세요 (interval 사용)");
  return SEMITONE_NAMES[n];
}

// ─── 화음 ───

export type ChordQuality =
  | "major" | "minor" | "diminished" | "augmented"
  | "dominant7" | "major7" | "minor7" | "half-diminished7" | "diminished7";

export const CHORD_NAME_KO: Record<ChordQuality, string> = {
  major: "장3화음",
  minor: "단3화음",
  diminished: "감3화음",
  augmented: "증3화음",
  dominant7: "딸림7화음",
  major7: "장7화음",
  minor7: "단7화음",
  "half-diminished7": "반감7화음",
  diminished7: "감7화음",
};

/** 근음 기준 반음 거리 */
const CHORD_TEMPLATES: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  "half-diminished7": [0, 3, 6, 10],
  diminished7: [0, 3, 6, 9],
};

export const INVERSION_KO = ["기본위치", "1전위", "2전위", "3전위"];

export interface ChordInfo {
  quality: ChordQuality;
  name: string;
  root: PitchClass;
  /** 0 기본위치, 1 1전위 … (가장 낮은 음이 근음·3음·5음·7음 중 무엇인지) */
  inversion: number;
  /** "C 장3화음 1전위" */
  label: string;
}

/**
 * 구성음으로 화음 종류·근음·전위를 찾는다. 중복음·옥타브 배치는 상관없다.
 * 철자 없이 MIDI만 주면 샵 철자로 근음을 표시한다. 맞는 화음이 없으면 null.
 */
export function chordType(notes: (Pitch | string | number)[]): ChordInfo | null {
  if (notes.length < 3) return null;
  const pitches = notes
    .map((n) => (typeof n === "number" ? midiToPitch(n) : toPitch(n)))
    .sort((x, y) => pitchToMidi(x) - pitchToMidi(y));
  const bass = pitches[0];
  const pcs = [...new Set(pitches.map(pitchClassNumber))];

  for (const candidate of pitches) {
    const rootPc = pitchClassNumber(candidate);
    const shape = pcs.map((pc) => mod(pc - rootPc, 12)).sort((x, y) => x - y);
    for (const [quality, template] of Object.entries(CHORD_TEMPLATES) as [ChordQuality, number[]][]) {
      if (template.length !== shape.length || !template.every((v, i) => v === shape[i])) continue;
      const bassOffset = mod(pitchClassNumber(bass) - rootPc, 12);
      const inversion = template.indexOf(bassOffset);
      const root = { letter: candidate.letter, alter: candidate.alter };
      const name = CHORD_NAME_KO[quality];
      return {
        quality,
        name,
        root,
        inversion,
        label: `${formatPitchClass(root)} ${name}${inversion > 0 ? ` ${INVERSION_KO[inversion]}` : ""}`,
      };
    }
  }
  return null;
}
