import { describe, expect, it } from "vitest";
import { playbackOrder, type RoadmapMeasure } from "./roadmap";

/** 마디 n개를 만들고 일부에 표시를 붙인다 (번호는 1부터) */
function score(n: number, marks: Record<number, RoadmapMeasure>): RoadmapMeasure[] {
  return Array.from({ length: n }, (_, i) => ({ ...(marks[i + 1] ?? {}) }));
}
const order = (m: RoadmapMeasure[]) => playbackOrder(m).steps.map((s) => s.measure + 1);
const vias = (m: RoadmapMeasure[]) => playbackOrder(m).steps.map((s) => s.via);

describe("악보 진행 순서", () => {
  it("표시가 없으면 차례대로", () => {
    expect(order(score(4, {}))).toEqual([1, 2, 3, 4]);
    expect(playbackOrder(score(4, {})).end).toBe("end");
  });

  it(":‖만 있으면 처음으로 돌아간다", () => {
    const m = score(8, { 4: { endRepeat: true }, 8: { barline: "final" } });
    expect(order(m)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(vias(m)[4]).toBe("repeat");
  });

  it("‖: :‖ 사이를 한 번 더", () => {
    const m = score(8, { 3: { startRepeat: true }, 6: { endRepeat: true } });
    expect(order(m)).toEqual([1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 7, 8]);
  });

  it("반복이 끝난 뒤의 :‖는 앞 반복 다음 마디로", () => {
    const m = score(6, { 2: { endRepeat: true }, 4: { endRepeat: true } });
    expect(order(m)).toEqual([1, 2, 1, 2, 3, 4, 3, 4, 5, 6]);
  });

  it("endRepeat 숫자만큼 반복", () => {
    expect(order(score(3, { 2: { endRepeat: 3 } }))).toEqual([1, 2, 1, 2, 1, 2, 3]);
  });

  it("1·2번 괄호: 두 번째에는 1번 괄호를 건너뛴다", () => {
    const m = score(8, {
      3: { ending: [1], endRepeat: true }, 4: { ending: [2] },
      5: { startRepeat: true }, 7: { ending: [1], endRepeat: true }, 8: { ending: [2], barline: "final" },
    });
    expect(order(m)).toEqual([1, 2, 3, 1, 2, 4, 5, 6, 7, 5, 6, 8]);
    expect(vias(m)[5]).toBe("ending");
  });

  it("괄호가 두 마디씩이어도", () => {
    const m = score(7, { 3: { ending: [1] }, 4: { ending: [1], endRepeat: true }, 5: { ending: [2] }, 6: { ending: [2] } });
    expect(order(m)).toEqual([1, 2, 3, 4, 1, 2, 5, 6, 7]);
  });

  it("절 괄호 1.2. / 3.: 세 번 부른다", () => {
    const m = score(8, { 1: { startRepeat: true }, 4: { ending: [1, 2], endRepeat: true }, 5: { ending: [3] } });
    expect(order(m)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 5, 6, 7, 8]);
  });

  it("D.C. al Fine: 처음으로 가서 Fine에서 끝", () => {
    const m = score(8, { 4: { fine: true, barline: "double" }, 8: { jump: "D.C. al Fine" } });
    const r = playbackOrder(m);
    expect(r.steps.map((s) => s.measure + 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4]);
    expect(r.end).toBe("fine");
    expect(r.steps[4].via).toBe("pass-fine");
    expect(r.steps[8]).toMatchObject({ via: "dc", afterJump: true });
  });

  it("D.S. al Fine: 세뇨로 가서 Fine에서 끝", () => {
    const m = score(8, { 3: { segno: true }, 5: { fine: true }, 8: { jump: "D.S. al Fine" } });
    expect(order(m)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 3, 4, 5]);
    expect(vias(m)[8]).toBe("ds");
  });

  it("D.S. al Coda: 세뇨로 가서 To Coda에서 코다로", () => {
    const m = score(8, { 2: { segno: true }, 4: { toCoda: true }, 6: { jump: "D.S. al Coda", barline: "double" }, 7: { coda: true }, 8: { barline: "final" } });
    const r = playbackOrder(m);
    expect(r.steps.map((s) => s.measure + 1)).toEqual([1, 2, 3, 4, 5, 6, 2, 3, 4, 7, 8]);
    expect(r.steps[4].via).toBe("pass-to-coda");
    expect(r.steps[9].via).toBe("coda");
    expect(r.end).toBe("end");
  });

  it("D.C. al Coda: 되돌아간 뒤에는 도돌이표를 반복하지 않는다", () => {
    const m = score(8, { 1: { startRepeat: true }, 2: { endRepeat: true }, 3: { toCoda: true }, 5: { jump: "D.C. al Coda" }, 6: { coda: true } });
    const r = playbackOrder(m);
    expect(r.steps.map((s) => s.measure + 1)).toEqual([1, 2, 1, 2, 3, 4, 5, 1, 2, 3, 6, 7, 8]);
    expect(r.steps[9].via).toBe("no-repeat");
  });

  it("종합: 반복 + 괄호 + D.S. al Coda (되돌아간 뒤에는 마지막 괄호만)", () => {
    const m = score(8, {
      3: { startRepeat: true, segno: true }, 5: { ending: [1], endRepeat: true }, 6: { ending: [2], toCoda: true },
      7: { jump: "D.S. al Coda" }, 8: { coda: true, barline: "final" },
    });
    const r = playbackOrder(m);
    expect(r.steps.map((s) => s.measure + 1)).toEqual([1, 2, 3, 4, 5, 3, 4, 6, 7, 3, 4, 6, 8]);
    expect(r.steps[8].via).toBe("pass-to-coda");
    expect(r.steps[11]).toMatchObject({ measure: 5, via: "ending", afterJump: true });
    expect(r.steps[12].via).toBe("coda");
  });

  it("D.C.는 Fine이 있으면 거기서, 없으면 끝까지", () => {
    expect(order(score(4, { 2: { fine: true }, 4: { jump: "D.C." } }))).toEqual([1, 2, 3, 4, 1, 2]);
    expect(order(score(3, { 3: { jump: "D.C." } }))).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it("잘못된 악보도 멈춘다", () => {
    const r = playbackOrder(score(2, { 1: { endRepeat: 1000000 } }));
    expect(r.steps.length).toBeLessThanOrEqual(1000);
  });
});
