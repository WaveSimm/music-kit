import { describe, expect, it } from "vitest";
import { formatNote, parseNote } from "../theory/notes";
import { accidentalFor, keySignatureSteps, ledgerSteps, pitchAtStep, staffStep } from "./staff-layout";

describe("staff-layout", () => {
  it("높은음자리표: 맨 아래 줄 E4, 둘째 줄 G4, 가운데 도는 아래 덧줄 하나", () => {
    expect(staffStep(parseNote("E4"), "treble")).toBe(0);
    expect(staffStep(parseNote("G4"), "treble")).toBe(2);
    expect(staffStep(parseNote("F5"), "treble")).toBe(8);
    expect(staffStep(parseNote("C4"), "treble")).toBe(-2);
    expect(ledgerSteps(-2)).toEqual([-2]);
    expect(ledgerSteps(staffStep(parseNote("A3"), "treble"))).toEqual([-2, -4]);
    expect(ledgerSteps(staffStep(parseNote("C6"), "treble"))).toEqual([10, 12]);
    expect(ledgerSteps(4)).toEqual([]);
  });

  it("낮은음자리표: 맨 아래 줄 G2, 넷째 줄 F3, 가운데 도는 위 덧줄 하나", () => {
    expect(staffStep(parseNote("G2"), "bass")).toBe(0);
    expect(staffStep(parseNote("F3"), "bass")).toBe(6);
    expect(staffStep(parseNote("C4"), "bass")).toBe(10);
  });

  it("오선을 탭하면 조표를 따른 음", () => {
    expect(formatNote(pitchAtStep(1, "treble", 0))).toBe("F4");
    expect(formatNote(pitchAtStep(1, "treble", 1))).toBe("F#4");
    expect(formatNote(pitchAtStep(1, "treble", 1, "natural"))).toBe("F4");
    expect(formatNote(pitchAtStep(4, "treble", -1))).toBe("Bb4");
    expect(formatNote(pitchAtStep(-2, "treble", 0, "sharp"))).toBe("C#4");
    expect(formatNote(pitchAtStep(10, "bass", 0))).toBe("C4");
    expect(formatNote(pitchAtStep(-1, "bass", 0))).toBe("F2");
  });

  it("조표 자리 표준 배치", () => {
    expect(keySignatureSteps(2)).toEqual([{ step: 8, kind: "sharp" }, { step: 5, kind: "sharp" }]);
    expect(keySignatureSteps(-3).map((a) => a.step)).toEqual([4, 7, 3]);
    expect(keySignatureSteps(0)).toEqual([]);
  });

  it("조표로 설명되지 않는 임시표만 표시", () => {
    expect(accidentalFor(parseNote("F#4"), 2)).toBeNull();
    expect(accidentalFor(parseNote("F4"), 2)).toBe("natural");
    expect(accidentalFor(parseNote("F#4"), 0)).toBe("sharp");
    expect(accidentalFor(parseNote("Bb4"), -1)).toBeNull();
    expect(accidentalFor(parseNote("Eb4"), -1)).toBe("flat");
    expect(accidentalFor(parseNote("F##4"), 0)).toBe("doubleSharp");
  });
});
