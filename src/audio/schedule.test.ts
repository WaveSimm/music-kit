import { describe, expect, it } from "vitest";
import { scheduleSequence } from "./schedule";

describe("scheduleSequence", () => {
  it("차례로: 박마다 시작, gate만큼 소리", () => {
    const { notes, total } = scheduleSequence([60, 62, 64], { bpm: 60 });
    expect(notes.map((n) => n.start)).toEqual([0, 1, 2]);
    expect(notes[0].duration).toBeCloseTo(0.95);
    expect(total).toBe(3);
  });

  it("음마다 박 수가 다를 때", () => {
    const { notes, total } = scheduleSequence([60, 62, 64], { bpm: 120, beats: [2, 1, 1], gate: 1 });
    expect(notes.map((n) => n.start)).toEqual([0, 1, 1.5]);
    expect(notes.map((n) => n.duration)).toEqual([1, 0.5, 0.5]);
    expect(total).toBe(2);
  });

  it("동시에(화음)", () => {
    const { notes, total } = scheduleSequence([60, 64, 67], { mode: "chord", bpm: 60, beats: 2 });
    expect(notes.every((n) => n.start === 0)).toBe(true);
    expect(total).toBe(2);
  });
});
