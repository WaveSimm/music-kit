import { describe, expect, it } from "vitest";
import { computerKeyLabel, computerKeyToMidi, midiToComputerKey, shiftComputerKeyBase } from "./computer-keys";

describe("computer-keys", () => {
  it("A=C, W=C#, ;=E (기준 C4)", () => {
    expect(computerKeyToMidi("KeyA", 60)).toBe(60);
    expect(computerKeyToMidi("KeyW", 60)).toBe(61);
    expect(computerKeyToMidi("KeyJ", 60)).toBe(71);
    expect(computerKeyToMidi("KeyK", 60)).toBe(72);
    expect(computerKeyToMidi("Semicolon", 60)).toBe(76);
    expect(computerKeyToMidi("KeyQ", 60)).toBeNull();
    expect(computerKeyToMidi("KeyZ", 60)).toBeNull();
  });

  it("건반 → 키 글자", () => {
    expect(midiToComputerKey(66, 60)).toBe("KeyT");
    expect(midiToComputerKey(59, 60)).toBeNull();
    expect(computerKeyLabel("KeyT")).toBe("T");
    expect(computerKeyLabel("Semicolon")).toBe(";");
  });

  it("옥타브 이동은 범위 안에서만", () => {
    expect(shiftComputerKeyBase(60, 1)).toBe(72);
    expect(shiftComputerKeyBase(60, -1)).toBe(48);
    expect(shiftComputerKeyBase(24, -1)).toBe(24);
    expect(shiftComputerKeyBase(96, 1)).toBe(96);
  });
});
