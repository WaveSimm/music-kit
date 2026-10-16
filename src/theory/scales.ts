// 음계: 장음계, 자연·화성·가락단음계, 반음계. 으뜸음부터 한 옥타브(8음, 반음계는 13음).
import { alterFor } from "./keys";
import {
  letterAt, letterIndex, mod, parsePitchClass, pitchClassNumber, pitchFromMidi, pitchToMidi,
  type Pitch, type PitchClass,
} from "./notes";
import { CHROMATIC_DOWN, CHROMATIC_UP, syllableToPitchClass } from "./solfege";

export type ScaleType = "major" | "natural-minor" | "harmonic-minor" | "melodic-minor" | "chromatic";

export const SCALE_NAME_KO: Record<ScaleType, string> = {
  major: "장음계",
  "natural-minor": "자연단음계",
  "harmonic-minor": "화성단음계",
  "melodic-minor": "가락단음계",
  chromatic: "반음계",
};

/** 으뜸음 기준 반음 거리 (올라갈 때) */
const STEPS: Record<Exclude<ScaleType, "chromatic">, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  "natural-minor": [0, 2, 3, 5, 7, 8, 10, 12],
  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11, 12],
  "melodic-minor": [0, 2, 3, 5, 7, 9, 11, 12],
};

export interface ScaleOptions {
  /** 으뜸음의 옥타브 (기본 4) */
  octave?: number;
  /** down이면 위 으뜸음에서 내려온다. 가락단음계는 내려올 때 자연단음계, 반음계는 내림 철자 */
  direction?: "up" | "down";
}

/**
 * scaleNotes("D", "major") → D4 E4 F#4 G4 A4 B4 C#5 D5
 * 반음계는 으뜸음을 도로 삼아 올라갈 때 디·리·피·시·리, 내려올 때 테·레·세·메·라 철자를 쓴다.
 */
export function scaleNotes(tonic: PitchClass | string, type: ScaleType, opts: ScaleOptions = {}): Pitch[] {
  const t = typeof tonic === "string" ? parsePitchClass(tonic) : tonic;
  const start = pitchFromMidi(12 * ((opts.octave ?? 4) + 1) + pitchClassNumber(t), t);
  const startMidi = pitchToMidi(start);
  const down = opts.direction === "down";

  if (type === "chromatic") {
    const key = { tonic: t, mode: "major" as const };
    const syllables = down ? CHROMATIC_DOWN : CHROMATIC_UP;
    const up = [...syllables, syllables[0]].map((s, i) =>
      pitchFromMidi(startMidi + i, syllableToPitchClass(s, key)),
    );
    return down ? up.reverse() : up;
  }

  const steps = down && type === "melodic-minor" ? STEPS["natural-minor"] : STEPS[type];
  const notes = steps.map((semi, i) => {
    const letter = letterAt(letterIndex(t.letter) + i);
    const midi = startMidi + semi;
    return pitchFromMidi(midi, { letter, alter: alterFor(letter, mod(midi, 12)) });
  });
  return down ? notes.reverse() : notes;
}

/**
 * 음계(으뜸음~위 으뜸음)가 음역 [lowMidi, highMidi] 안에 들어가는 옥타브 — scaleNotes의 octave 인자로 쓴다
 * (Cb처럼 옥타브 경계를 넘는 철자는 표기 옥타브와 다를 수 있다).
 * 꼭 맞는 옥타브가 없으면 벗어나는 반음 수가 가장 적은 옥타브 (같으면 낮은 쪽).
 */
export function fitScaleOctave(tonic: PitchClass | string, lowMidi: number, highMidi: number): number {
  const t = typeof tonic === "string" ? parsePitchClass(tonic) : tonic;
  let best = 4;
  let bestOver = Infinity;
  for (let octave = 0; octave <= 8; octave++) {
    const start = pitchToMidi(pitchFromMidi(12 * (octave + 1) + pitchClassNumber(t), t));
    const over = Math.max(0, lowMidi - start) + Math.max(0, start + 12 - highMidi);
    if (over < bestOver) {
      best = octave;
      bestOver = over;
    }
  }
  return best;
}

/** 음역 안에서 가장 낮은 으뜸음 (MIDI) — 으뜸음 계속 울리기용 */
export function lowestTonicInRange(tonic: PitchClass | string, lowMidi: number): number {
  const t = typeof tonic === "string" ? parsePitchClass(tonic) : tonic;
  return lowMidi + mod(pitchClassNumber(t) - lowMidi, 12);
}
