import { describe, expect, it } from "vitest";
import { chordType, interval, intervalName, intervalNameBySemitones } from "./intervals";
import { allKeys, keyFifths, keyNameKo, keySignature, parseKey, relativeMajorTonic, signatureAlter } from "./keys";
import { formatNote, freqToMidi, midiToFreq, midiToNote, noteToMidi, parseNote, pitchFromMidi } from "./notes";
import { scaleNotes } from "./scales";
import { doNoteName, solfegeFor, spellMidiInKey, syllableToPitchClass } from "./solfege";

const names = (ps: Parameters<typeof formatNote>[0][]) => ps.map(formatNote).join(" ");

describe("notes", () => {
  it("음이름 ↔ MIDI", () => {
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("A4")).toBe(69);
    expect(noteToMidi("C#4")).toBe(61);
    expect(noteToMidi("Db4")).toBe(61);
    expect(noteToMidi("B#3")).toBe(60);
    expect(noteToMidi("Cb4")).toBe(59);
    expect(noteToMidi("G2")).toBe(43);
    expect(noteToMidi("F##4")).toBe(67);
    expect(midiToNote(61)).toBe("C#4");
    expect(midiToNote(61, { prefer: "flat" })).toBe("Db4");
    expect(midiToNote(59)).toBe("B3");
  });

  it("옥타브 경계를 넘는 철자", () => {
    expect(formatNote(pitchFromMidi(60, { letter: "B", alter: 1 }))).toBe("B#3");
    expect(formatNote(pitchFromMidi(59, { letter: "C", alter: -1 }))).toBe("Cb4");
    expect(() => pitchFromMidi(60, { letter: "D", alter: 0 })).toThrow();
  });

  it("잘못된 음이름은 오류", () => {
    expect(() => parseNote("H4")).toThrow();
    expect(() => parseNote("C")).toThrow();
  });

  it("주파수", () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
    expect(freqToMidi(440)).toBe(69);
    expect(freqToMidi(261.626)).toBeCloseTo(60, 3);
  });
});

describe("keys", () => {
  it("조표 개수", () => {
    expect(keyFifths("C major")).toBe(0);
    expect(keyFifths("D major")).toBe(2);
    expect(keyFifths("Bb major")).toBe(-2);
    expect(keyFifths("F# major")).toBe(6);
    expect(keyFifths("Cb major")).toBe(-7);
    expect(keyFifths("A minor")).toBe(0);
    expect(keyFifths("E minor")).toBe(1);
    expect(keyFifths("D minor")).toBe(-1);
    expect(keyFifths("F# minor")).toBe(3);
    expect(keyFifths("Bb minor")).toBe(-5);
    expect(() => keyFifths("G# major")).toThrow();
  });

  it("조표의 음과 순서", () => {
    expect(keySignature("D major").accidentals).toEqual(["F#", "C#"]);
    expect(keySignature("Eb major").accidentals).toEqual(["Bb", "Eb", "Ab"]);
    expect(signatureAlter(2, "F")).toBe(1);
    expect(signatureAlter(2, "G")).toBe(0);
    expect(signatureAlter(-1, "B")).toBe(-1);
  });

  it("나란한조와 한국어 이름", () => {
    expect(relativeMajorTonic("A minor")).toEqual({ letter: "C", alter: 0 });
    expect(relativeMajorTonic("F# minor")).toEqual({ letter: "A", alter: 0 });
    expect(relativeMajorTonic("C minor")).toEqual({ letter: "E", alter: -1 });
    expect(keyNameKo("Bb major")).toBe("Bb장조");
    expect(keyNameKo(parseKey("f# 단조"))).toBe("F#단조");
  });

  it("조 목록은 조표 순서로 장조 15개", () => {
    const keys = allKeys("major");
    expect(keys).toHaveLength(15);
    expect(keys.map(keyFifths)).toEqual([-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("solfege (이동도)", () => {
  it("설계 핵심 케이스: G장조 F#4 = 티, C장조 F#4 = 피", () => {
    expect(solfegeFor("F#4", "G major").ko).toBe("티");
    expect(solfegeFor("F#4", "C major").ko).toBe("피");
  });

  it("철자로 올림/내림 구분", () => {
    expect(solfegeFor("Gb4", "C major").syllable).toBe("se");
    expect(solfegeFor("Bb4", "C major").syllable).toBe("te");
    expect(solfegeFor("C#4", "C major").syllable).toBe("di");
    expect(solfegeFor("Db4", "C major").syllable).toBe("ra");
    expect(solfegeFor("Ab4", "C major").syllable).toBe("le");
    expect(solfegeFor("A#4", "C major").syllable).toBe("li");
  });

  it("한글은 겹쳐도 id는 다르다 (라: la·ra, 리: ri·li, 레: re·le)", () => {
    expect(solfegeFor("A4", "C major")).toEqual({ syllable: "la", ko: "라" });
    expect(solfegeFor("Db4", "C major")).toEqual({ syllable: "ra", ko: "라" });
    expect(solfegeFor("Ab4", "C major")).toEqual({ syllable: "le", ko: "레" });
  });

  it("다른 조의 온음계", () => {
    expect(scaleNotes("Bb", "major").map((p) => solfegeFor(p, "Bb major").ko).join("")).toBe("도레미파솔라티도");
    expect(solfegeFor("C#5", "D major").ko).toBe("티");
    expect(solfegeFor("Eb4", "Bb major").ko).toBe("파");
  });

  it("단조는 라부터 (La-based minor), 화성단음계 7음은 시", () => {
    expect(doNoteName("A minor")).toBe("C");
    expect(doNoteName("D minor")).toBe("F");
    expect(solfegeFor("A4", "A minor").ko).toBe("라");
    expect(solfegeFor("G#4", "A minor").ko).toBe("시");
    expect(scaleNotes("A", "harmonic-minor").map((p) => solfegeFor(p, "A minor").ko).join(" ")).toBe(
      "라 티 도 레 미 파 시 라",
    );
  });

  it("계명 → 철자", () => {
    expect(syllableToPitchClass("fi", "D major")).toEqual({ letter: "G", alter: 1 });
    expect(syllableToPitchClass("te", "F major")).toEqual({ letter: "E", alter: -1 });
    expect(syllableToPitchClass("do", "E minor")).toEqual({ letter: "G", alter: 0 });
  });

  it("건반(MIDI) → 조성 안 철자와 계명", () => {
    const up = spellMidiInKey(66, "C major");
    expect(formatNote(up.pitch)).toBe("F#4");
    expect(up.ko).toBe("피");
    const down = spellMidiInKey(66, "C major", { direction: "down" });
    expect(formatNote(down.pitch)).toBe("Gb4");
    expect(down.ko).toBe("세");
    const inKey = spellMidiInKey(70, "F major");
    expect(formatNote(inKey.pitch)).toBe("Bb4");
    expect(inKey.ko).toBe("파");
    expect(formatNote(spellMidiInKey(60, "C# major").pitch)).toBe("B#3");
  });
});

describe("scales", () => {
  it("장음계", () => {
    expect(names(scaleNotes("D", "major"))).toBe("D4 E4 F#4 G4 A4 B4 C#5 D5");
    expect(names(scaleNotes("Bb", "major", { octave: 3 }))).toBe("Bb3 C4 D4 Eb4 F4 G4 A4 Bb4");
    expect(names(scaleNotes("F#", "major"))).toBe("F#4 G#4 A#4 B4 C#5 D#5 E#5 F#5");
  });

  it("단음계 3종", () => {
    expect(names(scaleNotes("A", "natural-minor"))).toBe("A4 B4 C5 D5 E5 F5 G5 A5");
    expect(names(scaleNotes("A", "harmonic-minor"))).toBe("A4 B4 C5 D5 E5 F5 G#5 A5");
    expect(names(scaleNotes("A", "melodic-minor"))).toBe("A4 B4 C5 D5 E5 F#5 G#5 A5");
    expect(names(scaleNotes("A", "melodic-minor", { direction: "down" }))).toBe("A5 G5 F5 E5 D5 C5 B4 A4");
    expect(names(scaleNotes("C", "harmonic-minor"))).toBe("C4 D4 Eb4 F4 G4 Ab4 B4 C5");
  });

  it("반음계: 올라갈 때 올림, 내려올 때 내림", () => {
    expect(names(scaleNotes("C", "chromatic"))).toBe("C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5");
    expect(names(scaleNotes("C", "chromatic", { direction: "down" }))).toBe(
      "C5 B4 Bb4 A4 Ab4 G4 Gb4 F4 E4 Eb4 D4 Db4 C4",
    );
    expect(scaleNotes("G", "chromatic").map((p) => solfegeFor(p, "G major").ko).join(" ")).toBe(
      "도 디 레 리 미 파 피 솔 시 라 리 티 도",
    );
  });
});

describe("intervals", () => {
  it("철자로 계산한 음정", () => {
    expect(intervalName("C4", "E4")).toBe("장3도");
    expect(intervalName("C4", "Eb4")).toBe("단3도");
    expect(intervalName("E4", "C4")).toBe("장3도");
    expect(intervalName("C4", "G4")).toBe("완전5도");
    expect(intervalName("C4", "F#4")).toBe("증4도");
    expect(intervalName("C4", "Gb4")).toBe("감5도");
    expect(intervalName("C4", "C5")).toBe("완전8도");
    expect(intervalName("C4", "C4")).toBe("완전1도");
    expect(intervalName("C4", "E5")).toBe("장10도");
    expect(intervalName("F4", "G#4")).toBe("증2도");
    expect(intervalName("B3", "F4")).toBe("감5도");
    expect(interval("C4", "A4").semitones).toBe(9);
  });

  it("반음 수로 부르는 이름", () => {
    expect(intervalNameBySemitones(3)).toBe("단3도");
    expect(intervalNameBySemitones(-4)).toBe("장3도");
    expect(intervalNameBySemitones(6)).toBe("증4도");
  });
});

describe("chords", () => {
  it("삼화음 4종과 전위", () => {
    expect(chordType(["C4", "E4", "G4"])?.label).toBe("C 장3화음");
    expect(chordType(["A3", "C4", "E4"])?.label).toBe("A 단3화음");
    expect(chordType(["B3", "D4", "F4"])?.label).toBe("B 감3화음");
    expect(chordType(["C4", "E4", "G#4"])?.name).toBe("증3화음");
    expect(chordType(["E4", "G4", "C5"])?.label).toBe("C 장3화음 1전위");
    expect(chordType(["G3", "C4", "E4"])?.label).toBe("C 장3화음 2전위");
    expect(chordType(["C3", "G3", "C4", "E4", "G4"])?.label).toBe("C 장3화음");
  });

  it("7화음", () => {
    expect(chordType(["G3", "B3", "D4", "F4"])?.label).toBe("G 딸림7화음");
    expect(chordType(["F3", "G3", "B3", "D4"])?.label).toBe("G 딸림7화음 3전위");
    expect(chordType(["C4", "E4", "G4", "B4"])?.name).toBe("장7화음");
    expect(chordType(["B3", "D4", "F4", "A4"])?.name).toBe("반감7화음");
    expect(chordType(["B3", "D4", "F4", "Ab4"])?.name).toBe("감7화음");
  });

  it("MIDI만 주어도 판별, 화음이 아니면 null", () => {
    expect(chordType([62, 66, 69])?.label).toBe("D 장3화음");
    expect(chordType(["C4", "D4", "E4"])).toBeNull();
    expect(chordType(["C4", "E4"])).toBeNull();
  });
});

describe("음역에 맞춘 옥타브", async () => {
  const { fitScaleOctave, lowestTonicInRange } = await import("./scales");
  it("여성 G3~G5(55~79), 남성 G2~G4(43~67)", () => {
    expect(fitScaleOctave("C", 55, 79)).toBe(4); // C4~C5
    expect(fitScaleOctave("G", 55, 79)).toBe(3); // G3~G4
    expect(fitScaleOctave("A", 55, 79)).toBe(3); // A3~A4
    expect(fitScaleOctave("C", 43, 67)).toBe(3); // C3~C4
    expect(fitScaleOctave("G", 43, 67)).toBe(2); // G2~G3
    expect(fitScaleOctave("F#", 43, 67)).toBe(3); // F#3~F#4 (G2 아래는 안 됨)
    expect(fitScaleOctave("Cb", 55, 79)).toBe(3); // scaleNotes octave 3 → 소리 B3(59)부터, 표기는 Cb4
  });
  it("음역 안 가장 낮은 으뜸음", () => {
    expect(lowestTonicInRange("G", 43)).toBe(43);
    expect(lowestTonicInRange("C", 43)).toBe(48);
    expect(lowestTonicInRange("F#", 55)).toBe(66);
    expect(lowestTonicInRange("Ab", 55)).toBe(56);
  });
});
