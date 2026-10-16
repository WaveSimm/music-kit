// 이동도 계명 (미국식). 7음은 '티', '시'는 올림 솔에만.
// 반음계: 올림 디·리·피·시·리 / 내림 라·메·세·레·테. 단조는 라부터 부른다(La-based minor).
// 한글로는 ra·la가 둘 다 '라', ri·li가 '리', re·le가 '레'라서 내부에서는 영문 id로 구분한다.
import { doPitchClass, alterFor, toKey, type Key } from "./keys";
import {
  formatPitchClass, letterAt, letterIndex, mod, pitchClassNumber, pitchFromMidi, toPitch,
  type Pitch, type PitchClass,
} from "./notes";

export type Syllable =
  | "do" | "di" | "ra" | "re" | "ri" | "me" | "mi" | "fa" | "fi"
  | "se" | "sol" | "si" | "le" | "la" | "li" | "te" | "ti";

export const SYLLABLE_KO: Record<Syllable, string> = {
  do: "도", di: "디", ra: "라", re: "레", ri: "리", me: "메", mi: "미", fa: "파", fi: "피",
  se: "세", sol: "솔", si: "시", le: "레", la: "라", li: "리", te: "테", ti: "티",
};

/** 도 기준 반음 거리, 도 기준 글자 거리(0=도 … 6=티) */
const SYLLABLE_INFO: Record<Syllable, { semitones: number; degree: number }> = {
  do: { semitones: 0, degree: 0 }, di: { semitones: 1, degree: 0 },
  ra: { semitones: 1, degree: 1 }, re: { semitones: 2, degree: 1 }, ri: { semitones: 3, degree: 1 },
  me: { semitones: 3, degree: 2 }, mi: { semitones: 4, degree: 2 },
  fa: { semitones: 5, degree: 3 }, fi: { semitones: 6, degree: 3 },
  se: { semitones: 6, degree: 4 }, sol: { semitones: 7, degree: 4 }, si: { semitones: 8, degree: 4 },
  le: { semitones: 8, degree: 5 }, la: { semitones: 9, degree: 5 }, li: { semitones: 10, degree: 5 },
  te: { semitones: 10, degree: 6 }, ti: { semitones: 11, degree: 6 },
};

/** 올라갈 때 쓰는 반음계 (도 디 레 리 미 파 피 솔 시 라 리 티) */
export const CHROMATIC_UP: Syllable[] = ["do", "di", "re", "ri", "mi", "fa", "fi", "sol", "si", "la", "li", "ti"];
/** 내려갈 때 쓰는 반음계 (도 라 레 메 미 파 세 솔 레 라 테 티) — 인덱스는 도 기준 반음 거리 */
export const CHROMATIC_DOWN: Syllable[] = ["do", "ra", "re", "me", "mi", "fa", "se", "sol", "le", "la", "te", "ti"];

/** 온음계 7음 (도 레 미 파 솔 라 티) */
export const DIATONIC: Syllable[] = ["do", "re", "mi", "fa", "sol", "la", "ti"];

const DIATONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export interface SolfegeResult {
  syllable: Syllable;
  ko: string;
}

function result(syllable: Syllable): SolfegeResult {
  return { syllable, ko: SYLLABLE_KO[syllable] };
}

/**
 * 철자가 있는 음의 계명. 철자로 올림/내림을 정한다:
 * C major에서 F#4 → 피(fi), Gb4 → 세(se). G major에서 F#4 → 티.
 * 표준 반음계 음절이 없는 철자(E#, Cb 등)는 같은 소리의 음절로 대신한다.
 */
export function solfegeFor(note: Pitch | PitchClass | string, key: Key | string): SolfegeResult {
  const p = typeof note === "string" ? toPitch(note) : note;
  const doPc = doPitchClass(toKey(key));
  const degree = mod(letterIndex(p.letter) - letterIndex(doPc.letter), 7);
  const semitones = mod(pitchClassNumber(p) - pitchClassNumber(doPc), 12);
  const diff = mod(semitones - DIATONIC_SEMITONES[degree] + 6, 12) - 6;
  return result((diff < 0 ? CHROMATIC_DOWN : CHROMATIC_UP)[semitones]);
}

/** 계명 → 조성 안의 음 철자 (D major의 fi → G#) */
export function syllableToPitchClass(syllable: Syllable, key: Key | string): PitchClass {
  const doPc = doPitchClass(toKey(key));
  const { semitones, degree } = SYLLABLE_INFO[syllable];
  const letter = letterAt(letterIndex(doPc.letter) + degree);
  return { letter, alter: alterFor(letter, mod(pitchClassNumber(doPc) + semitones, 12)) };
}

/**
 * 조성 안에서 MIDI → 철자 있는 음과 계명. 건반을 눌렀을 때 쓴다.
 * 검은 건반(조성 밖 음)은 direction으로 올림(디·리…)/내림(라·메…)을 고른다. 기본은 올림.
 */
export function spellMidiInKey(
  midi: number,
  key: Key | string,
  opts: { direction?: "up" | "down" } = {},
): { pitch: Pitch } & SolfegeResult {
  const k = toKey(key);
  const doPc = doPitchClass(k);
  const semitones = mod(midi - pitchClassNumber(doPc), 12);
  const syllable = (opts.direction === "down" ? CHROMATIC_DOWN : CHROMATIC_UP)[semitones];
  const pc = syllableToPitchClass(syllable, k);
  return { pitch: pitchFromMidi(midi, pc), ...result(syllable) };
}

/** 계명의 도 기준 반음 거리 (육성 샘플·판정용) */
export function syllableSemitones(syllable: Syllable): number {
  return SYLLABLE_INFO[syllable].semitones;
}

/** 온음계 음절인지 (1차 육성 샘플은 온음계 7음만) */
export function isDiatonic(syllable: Syllable): boolean {
  return DIATONIC.includes(syllable);
}

/** 이 조성에서 '도'의 음 (글자 + 임시표) — S2 "조표 보고 도 찾기"용 */
export function doNoteName(key: Key | string): string {
  return formatPitchClass(doPitchClass(toKey(key)));
}
