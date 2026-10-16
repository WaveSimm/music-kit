// 오선 위치 계산 — 순수 함수. step 0 = 맨 아래 줄, 1 = 첫째 칸, 8 = 맨 위 줄.
import { signatureAlter } from "../theory/keys";
import { letterAt, letterIndex, type Pitch } from "../theory/notes";

export type Clef = "treble" | "bass";

export const CLEF_NAME_KO: Record<Clef, string> = { treble: "높은음자리표", bass: "낮은음자리표" };

/** 맨 아래 줄의 음: 높은음자리표 E4, 낮은음자리표 G2 (옥타브×7 + 글자 순서) */
const BOTTOM_LINE: Record<Clef, number> = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };

/** 음자리표 기준선의 step: 높은음자리표는 G4(둘째 줄), 낮은음자리표는 F3(넷째 줄) */
export const CLEF_ANCHOR_STEP: Record<Clef, number> = { treble: 2, bass: 6 };

function diatonicIndex(p: Pitch): number {
  return p.octave * 7 + letterIndex(p.letter);
}

export function staffStep(p: Pitch, clef: Clef): number {
  return diatonicIndex(p) - BOTTOM_LINE[clef];
}

/** 오선 자리 → 음. 임시표는 조표를 따른다(adjust로 #·b을 더 붙일 수 있음). */
export function pitchAtStep(step: number, clef: Clef, fifths: number, adjust: "key" | "sharp" | "flat" | "natural" = "key"): Pitch {
  const index = BOTTOM_LINE[clef] + step;
  const letter = letterAt(index);
  const octave = Math.floor(index / 7);
  const base = adjust === "key" ? signatureAlter(fifths, letter) : 0;
  const alter = adjust === "sharp" ? 1 : adjust === "flat" ? -1 : base;
  return { letter, alter, octave };
}

/** 덧줄이 필요한 step 목록 (아래 덧줄 -2, -4 …, 위 덧줄 10, 12 …) */
export function ledgerSteps(step: number): number[] {
  const out: number[] = [];
  for (let s = -2; s >= step; s -= 2) out.push(s);
  for (let s = 10; s <= step; s += 2) out.push(s);
  return out;
}

// 조표 자리 (높은음자리표·낮은음자리표 모두 같은 step — 표준 배치)
const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4]; // F C G D A E B
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1]; // B E A D G C F

export function keySignatureSteps(fifths: number): { step: number; kind: "sharp" | "flat" }[] {
  if (fifths > 0) return SHARP_STEPS.slice(0, fifths).map((step) => ({ step, kind: "sharp" as const }));
  if (fifths < 0) return FLAT_STEPS.slice(0, -fifths).map((step) => ({ step, kind: "flat" as const }));
  return [];
}

export type AccidentalKind = "sharp" | "flat" | "natural" | "doubleSharp" | "doubleFlat";

/** 조표로 설명되지 않는 임시표만 돌려준다 (D장조의 F# → 없음, D장조의 F → 제자리표) */
export function accidentalFor(p: Pitch, fifths: number): AccidentalKind | null {
  if (p.alter === signatureAlter(fifths, p.letter)) return null;
  switch (p.alter) {
    case 0: return "natural";
    case 1: return "sharp";
    case -1: return "flat";
    case 2: return "doubleSharp";
    case -2: return "doubleFlat";
    default: return null;
  }
}

/** 이 음자리표에서 보통 쓰는 음역 (건반 도구의 자동 음자리표 판단용) */
export function fitsClef(p: Pitch, clef: Clef): boolean {
  const step = staffStep(p, clef);
  return step >= -6 && step <= 14;
}
