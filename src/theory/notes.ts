// 음이름 ↔ MIDI ↔ 주파수. 표기는 영문(C, C#, Bb), 옥타브는 과학적 표기(C4 = 가운데 도 = MIDI 60).

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type Letter = (typeof LETTERS)[number];

/** 철자가 있는 음 — 같은 MIDI라도 F#4와 Gb4는 다른 음으로 다룬다(계명이 달라짐). */
export interface Pitch {
  letter: Letter;
  /** 임시표: -2(bb) -1(b) 0 1(#) 2(##) */
  alter: number;
  octave: number;
}

/** 옥타브 없는 음(조성의 으뜸음 등) */
export type PitchClass = Omit<Pitch, "octave">;

/** C=0 … B=11, 임시표 없는 음의 반음 위치 */
export const NATURAL_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const NOTE_RE = /^([A-Ga-g])(##|bb|#|b)?(-?\d+)?$/;

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

export function letterAt(index: number): Letter {
  return LETTERS[((index % 7) + 7) % 7];
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function parseAlter(acc: string | undefined): number {
  switch (acc) {
    case "##": return 2;
    case "#": return 1;
    case "b": return -1;
    case "bb": return -2;
    default: return 0;
  }
}

export function accidentalText(alter: number): string {
  if (alter > 0) return "#".repeat(alter);
  if (alter < 0) return "b".repeat(-alter);
  return "";
}

/** "C#4" → {letter:"C", alter:1, octave:4}. 옥타브가 없으면 오류. */
export function parseNote(text: string): Pitch {
  const m = NOTE_RE.exec(text.trim());
  if (!m || m[3] === undefined) throw new Error(`음이름을 읽을 수 없습니다: "${text}"`);
  return { letter: m[1].toUpperCase() as Letter, alter: parseAlter(m[2]), octave: Number(m[3]) };
}

/** "Bb" → {letter:"B", alter:-1}. 옥타브가 붙어 있어도 무시한다. */
export function parsePitchClass(text: string): PitchClass {
  const m = NOTE_RE.exec(text.trim());
  if (!m) throw new Error(`음이름을 읽을 수 없습니다: "${text}"`);
  return { letter: m[1].toUpperCase() as Letter, alter: parseAlter(m[2]) };
}

export function formatPitchClass(p: PitchClass): string {
  return p.letter + accidentalText(p.alter);
}

export function formatNote(p: Pitch): string {
  return formatPitchClass(p) + p.octave;
}

export function toPitch(note: Pitch | string): Pitch {
  return typeof note === "string" ? parseNote(note) : note;
}

/** 0~11 */
export function pitchClassNumber(p: PitchClass): number {
  return mod(NATURAL_PC[p.letter] + p.alter, 12);
}

export function pitchToMidi(p: Pitch): number {
  return 12 * (p.octave + 1) + NATURAL_PC[p.letter] + p.alter;
}

export function noteToMidi(note: Pitch | string): number {
  return pitchToMidi(toPitch(note));
}

/** 철자와 MIDI 번호로 옥타브를 맞춘다 (B#3 = C4 = 60처럼 옥타브 경계를 넘는 철자 처리). */
export function pitchFromMidi(midi: number, pc: PitchClass): Pitch {
  const octave = Math.round((midi - NATURAL_PC[pc.letter] - pc.alter) / 12) - 1;
  const p = { ...pc, octave };
  if (pitchToMidi(p) !== midi) {
    throw new Error(`${formatPitchClass(pc)}는 MIDI ${midi}와 맞지 않습니다`);
  }
  return p;
}

const SHARP_NAMES: PitchClass[] = [
  { letter: "C", alter: 0 }, { letter: "C", alter: 1 }, { letter: "D", alter: 0 }, { letter: "D", alter: 1 },
  { letter: "E", alter: 0 }, { letter: "F", alter: 0 }, { letter: "F", alter: 1 }, { letter: "G", alter: 0 },
  { letter: "G", alter: 1 }, { letter: "A", alter: 0 }, { letter: "A", alter: 1 }, { letter: "B", alter: 0 },
];
const FLAT_NAMES: PitchClass[] = [
  { letter: "C", alter: 0 }, { letter: "D", alter: -1 }, { letter: "D", alter: 0 }, { letter: "E", alter: -1 },
  { letter: "E", alter: 0 }, { letter: "F", alter: 0 }, { letter: "G", alter: -1 }, { letter: "G", alter: 0 },
  { letter: "A", alter: -1 }, { letter: "A", alter: 0 }, { letter: "B", alter: -1 }, { letter: "B", alter: 0 },
];

/** 조성 없이 MIDI → 음. 검은 건반은 prefer에 따라 #/b. 조성 안의 철자는 solfege.spellMidiInKey를 쓴다. */
export function midiToPitch(midi: number, opts: { prefer?: "sharp" | "flat" } = {}): Pitch {
  const names = opts.prefer === "flat" ? FLAT_NAMES : SHARP_NAMES;
  return pitchFromMidi(midi, names[mod(midi, 12)]);
}

export function midiToNote(midi: number, opts: { prefer?: "sharp" | "flat" } = {}): string {
  return formatNote(midiToPitch(midi, opts));
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** 주파수 → 실수 MIDI (60.25 = C4보다 25센트 높음) */
export function freqToMidi(hz: number, a4 = 440): number {
  return 69 + 12 * Math.log2(hz / a4);
}

/** 두 음의 글자 간격(같은 글자 0, C→E 2), 옥타브 포함 */
export function letterSteps(from: Pitch, to: Pitch): number {
  return to.octave * 7 + letterIndex(to.letter) - (from.octave * 7 + letterIndex(from.letter));
}
