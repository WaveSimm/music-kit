import { describe, expect, it } from "vitest";
import { midiToFreq } from "../theory/notes";
import { createPitchDetector } from "./detect";
import { centsFrom, judgeNote, judgeSing, median, type PitchPoint } from "./judge";

const RATE = 48000;
const SIZE = 2048;

/** 목소리 비슷한 소리: 배음이 있고, 둘째 배음이 꽤 크다 (옥타브 오검출이 잘 나는 모양) */
function voice(hz: number, amp = 0.3, harmonics = [1, 0.8, 0.5, 0.3, 0.2]): Float32Array {
  const buf = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    let v = 0;
    harmonics.forEach((a, k) => (v += a * Math.sin((2 * Math.PI * hz * (k + 1) * i) / RATE)));
    buf[i] = (amp * v) / harmonics.reduce((s, a) => s + a, 0);
  }
  return buf;
}

function noise(amp: number): Float32Array {
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
  return Float32Array.from({ length: SIZE }, () => amp * rand());
}

describe("createPitchDetector", () => {
  const detect = createPitchDetector(SIZE);

  it.each([
    ["사인파 A3", 220, [1]],
    ["남성 최저 G2", midiToFreq(43), undefined],
    ["여성 최고 G5", midiToFreq(79), undefined],
    ["C4", midiToFreq(60), undefined],
  ] as const)("%s: ±5센트 안", (_, hz, harmonics) => {
    const r = detect(voice(hz, 0.3, harmonics ? [...harmonics] : undefined), RATE);
    expect(r.hz).not.toBeNull();
    expect(Math.abs(centsFrom(r.hz!, 69 + 12 * Math.log2(hz / 440)))).toBeLessThan(5);
  });

  it("작은 소리·잡음은 음높이 없음", () => {
    expect(detect(voice(220, 0.005), RATE).hz).toBeNull();
    expect(detect(noise(0.3), RATE).hz).toBeNull();
    expect(detect(new Float32Array(SIZE), RATE).hz).toBeNull();
  });
});

/** t0~t1 동안 50ms마다, hzAt(t)로 부른 기록 */
function sung(t0: number, t1: number, hzAt: (t: number) => number | null): PitchPoint[] {
  const out: PitchPoint[] = [];
  for (let t = t0; t < t1; t += 0.05) out.push({ t, hz: hzAt(t) });
  return out;
}
const off = (midi: number, cents: number) => midiToFreq(midi + cents / 100);
const C4 = { midi: 60, start: 0, end: 1 };

describe("judgeNote", () => {
  it("±50센트 안은 맞음, 밖은 높음·낮음 (경계 포함)", () => {
    expect(judgeNote(sung(0, 1.2, () => off(60, 20)), C4)).toMatchObject({ verdict: "ok" });
    expect(judgeNote(sung(0, 1.2, () => off(60, 49)), C4).verdict).toBe("ok");
    expect(judgeNote(sung(0, 1.2, () => off(60, -49)), C4).verdict).toBe("ok");
    expect(judgeNote(sung(0, 1.2, () => off(60, 51)), C4).verdict).toBe("high");
    expect(judgeNote(sung(0, 1.2, () => off(60, -60)), C4).verdict).toBe("low");
    expect(judgeNote(sung(0, 1.2, () => off(60, 30)), C4, { tolerance: 25 }).verdict).toBe("high");
    expect(judgeNote(sung(0, 1.2, () => off(60, 20)), C4).cents).toBeCloseTo(20, 5);
  });

  it("음을 찾아가는 앞부분과 잠깐 튀는 값은 판정에 넣지 않는다", () => {
    const scoop = sung(0, 1.2, (t) => (t < 0.3 ? off(60, -150) : off(60, 10)));
    expect(judgeNote(scoop, C4).verdict).toBe("ok");
    // 검출기가 가끔 한 옥타브 위를 잡아도 중앙값은 흔들리지 않는다
    const glitch = sung(0, 1.2, (t) => (Math.round(t * 20) % 5 === 0 ? off(60, 1200) : off(60, 0)));
    expect(judgeNote(glitch, C4).verdict).toBe("ok");
  });

  it("늦게 들어간 만큼(lag) 판정 구간을 뒤로 민다", () => {
    // 0.8초까지 B3에 머물다 C4로 — 기본 lag 0.1이면 판정 구간(0.4~1.05초)의 절반 넘게 B3
    const late = sung(0, 1.6, (t) => (t < 0.8 ? midiToFreq(59) : midiToFreq(60)));
    expect(judgeNote(late, C4).verdict).not.toBe("ok");
    expect(judgeNote(late, C4, { lag: 0.4 }).verdict).toBe("ok");
  });

  it("소리가 없거나 거의 잡히지 않으면 소리 없음", () => {
    expect(judgeNote(sung(0, 1.2, () => null), C4)).toMatchObject({ verdict: "missing", cents: null });
    expect(judgeNote([], C4).verdict).toBe("missing");
    const sparse = sung(0, 1.2, (t) => (Math.round(t * 20) % 5 === 0 ? midiToFreq(60) : null));
    expect(judgeNote(sparse, C4).verdict).toBe("missing");
  });

  it("음은 맞고 옥타브만 다르면 octave", () => {
    expect(judgeNote(sung(0, 1.2, () => off(48, 15)), C4)).toMatchObject({ verdict: "octave", octave: -1 });
    expect(judgeNote(sung(0, 1.2, () => off(48, 15)), C4).cents).toBeCloseTo(15, 5);
    // 옥타브 근처라도 음이 틀리면 그냥 낮음
    expect(judgeNote(sung(0, 1.2, () => midiToFreq(50)), C4)).toMatchObject({ verdict: "low", octave: 0 });
  });
});

describe("judgeSing", () => {
  it("음표마다 판정하고 맞은 비율을 낸다", () => {
    const targets = [60, 62, 64, 65].map((midi, i) => ({ midi, start: i, end: i + 1 }));
    const sing = [60, 62, 63, 65];
    const points = sung(0, 4.2, (t) => midiToFreq(sing[Math.min(3, Math.floor(t))]));
    const r = judgeSing(points, targets);
    expect(r.notes.map((n) => n.verdict)).toEqual(["ok", "ok", "low", "ok"]);
    expect(r.accuracy).toBe(0.75);
    expect(judgeSing([], []).accuracy).toBe(0);
  });

  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});
