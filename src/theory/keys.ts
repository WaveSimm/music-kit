// 조성과 조표. 조표는 MusicXML처럼 fifths(+ 샵 개수, - 플랫 개수)로 나타낸다.
import {
  LETTERS, NATURAL_PC, formatPitchClass, letterAt, letterIndex, mod, parsePitchClass,
  type Letter, type PitchClass,
} from "./notes";

export type Mode = "major" | "minor";

export interface Key {
  tonic: PitchClass;
  mode: Mode;
}

const MODE_WORDS: Record<string, Mode> = { major: "major", minor: "minor", 장조: "major", 단조: "minor" };

/** "D major", "F# minor", "Bb 장조" → Key */
export function parseKey(text: string): Key {
  const m = /^\s*([A-Ga-g](?:##|bb|#|b)?)\s*(major|minor|장조|단조)\s*$/i.exec(text);
  if (!m) throw new Error(`조성을 읽을 수 없습니다: "${text}" (예: "D major", "A minor")`);
  return { tonic: parsePitchClass(m[1]), mode: MODE_WORDS[m[2].toLowerCase()] };
}

export function toKey(key: Key | string): Key {
  return typeof key === "string" ? parseKey(key) : key;
}

export function formatKey(key: Key): string {
  return `${formatPitchClass(key.tonic)} ${key.mode}`;
}

/** 한국어 조 이름: "D장조", "F#단조" */
export function keyNameKo(key: Key | string): string {
  const k = toKey(key);
  return `${formatPitchClass(k.tonic)}${k.mode === "major" ? "장조" : "단조"}`;
}

// 임시표 없는 글자를 으뜸음으로 한 장조의 조표 (C 0, G 1, D 2 … F -1)
const MAJOR_FIFTHS: Record<Letter, number> = { C: 0, D: 2, E: 4, F: -1, G: 1, A: 3, B: 5 };

/** 조표: +면 샵 개수, -면 플랫 개수. 7개를 넘는 조(G# major 등)는 오류. */
export function keyFifths(key: Key | string): number {
  const k = toKey(key);
  const fifths = MAJOR_FIFTHS[k.tonic.letter] + 7 * k.tonic.alter - (k.mode === "minor" ? 3 : 0);
  if (Math.abs(fifths) > 7) throw new Error(`조표가 7개를 넘는 조입니다: ${formatKey(k)}`);
  return fifths;
}

const SHARP_ORDER: Letter[] = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER: Letter[] = ["B", "E", "A", "D", "G", "C", "F"];

export interface KeySignature {
  fifths: number;
  /** 조표에 붙는 음, 붙는 순서대로: D major → ["F#", "C#"] */
  accidentals: string[];
}

export function keySignature(key: Key | string): KeySignature {
  const fifths = keyFifths(key);
  const accidentals =
    fifths >= 0
      ? SHARP_ORDER.slice(0, fifths).map((l) => `${l}#`)
      : FLAT_ORDER.slice(0, -fifths).map((l) => `${l}b`);
  return { fifths, accidentals };
}

/** 조표가 이 글자에 붙이는 임시표 (D major에서 F → 1) */
export function signatureAlter(fifths: number, letter: Letter): number {
  if (fifths > 0) return SHARP_ORDER.indexOf(letter) < fifths ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.indexOf(letter) < -fifths ? -1 : 0;
  return 0;
}

/** 단조의 나란한조 장조 으뜸음 (A minor → C). 장조는 자기 자신. */
export function relativeMajorTonic(key: Key | string): PitchClass {
  const k = toKey(key);
  if (k.mode === "major") return k.tonic;
  const letter = letterAt(letterIndex(k.tonic.letter) + 2);
  const pc = mod(NATURAL_PC[k.tonic.letter] + k.tonic.alter + 3, 12);
  return { letter, alter: alterFor(letter, pc) };
}

/** 이동도의 "도" 음. 단조는 라부터 부르기(La-based minor)이므로 나란한조 장조의 으뜸음. */
export function doPitchClass(key: Key | string): PitchClass {
  return relativeMajorTonic(key);
}

/** 글자에 임시표를 붙여 반음 위치 pc를 만들 때 필요한 alter (-2~2) */
export function alterFor(letter: Letter, pc: number): number {
  const diff = mod(pc - NATURAL_PC[letter] + 6, 12) - 6;
  if (Math.abs(diff) > 2) throw new Error(`${letter}에 임시표를 붙여 반음 위치 ${pc}를 만들 수 없습니다`);
  return diff;
}

/** 조표 선택 목록용: 조표 개수 순서의 장조·단조 (C/a, G/e, … Cb/ab) */
export function allKeys(mode: Mode): Key[] {
  const out: Key[] = [];
  for (let f = -7; f <= 7; f++) {
    for (const letter of LETTERS) {
      for (const alter of [-1, 0, 1]) {
        const k: Key = { tonic: { letter, alter }, mode };
        try {
          if (keyFifths(k) === f) out.push(k);
        } catch {
          // 조표 7개 초과 — 목록에서 제외
        }
      }
    }
  }
  return out;
}
