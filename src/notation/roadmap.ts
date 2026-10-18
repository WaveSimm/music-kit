// 악보 진행 — 도돌이표·괄호·D.C.·D.S.·Fine·코다를 따라 마디를 연주하는 순서. 순수 함수.
//
// 규칙 (일반적인 관례):
// - `:‖`는 앞의 `‖:`로 돌아간다. `‖:`가 없으면 처음으로(앞에서 반복이 끝났으면 그 바로 다음 마디로).
// - 반복 횟수: 괄호가 있으면 괄호 번호의 최댓값(1.2. / 3. → 세 번), 없으면 두 번. endRepeat에 숫자를 주면 그 횟수.
// - n번째로 지날 때는 n이 붙은 괄호만 연주하고 나머지 괄호는 건너뛴다.
// - D.C.는 처음으로, D.S.는 세뇨(𝄋)로. 되돌아간 뒤에는 도돌이표를 반복하지 않고 괄호는 마지막 번호만 연주한다.
//   al Fine이면 Fine에서 끝, al Coda면 To Coda에서 코다(𝄌)로 건너뛴다. 처음 지날 때의 Fine·To Coda는 무시한다.
// - 되돌아가기(D.C./D.S.)는 한 번만 한다.
import type { Pitch } from "../theory/notes";

export type JumpKind = "D.C." | "D.C. al Fine" | "D.C. al Coda" | "D.S." | "D.S. al Fine" | "D.S. al Coda";

export interface RoadmapMeasure {
  /** 마디 앞에 ‖: */
  startRepeat?: boolean;
  /** 마디 끝에 :‖ (숫자면 모두 몇 번 연주하는지) */
  endRepeat?: boolean | number;
  /** 괄호 번호: [1] = 1번 괄호, [1, 2] = "1.2." 괄호. 이어진 마디의 같은 번호는 한 괄호 */
  ending?: number[];
  /** 마디 앞에 세뇨 𝄋 */
  segno?: boolean;
  /** 코다 𝄌 — 여기서 코다가 시작한다 (To Coda가 건너오는 곳) */
  coda?: boolean;
  /** 마디 끝에 To Coda */
  toCoda?: boolean;
  /** 마디 끝에 Fine */
  fine?: boolean;
  /** 마디 끝에 D.C./D.S. */
  jump?: JumpKind;
  /** 마디 끝 세로줄 (도돌이표가 있으면 그것이 우선) */
  barline?: "single" | "double" | "final";
}

export interface ScoreNote {
  pitch: Pitch | string;
  /** 박 수 (4분음표 = 1): 4 온음표, 3 점2분음표, 2 2분음표, 1.5 점4분음표, 1 4분음표 */
  beats: number;
}

/** 음표가 들어 있는 마디 (react의 MeasureScore가 그린다) */
export interface ScoreMeasure extends RoadmapMeasure {
  notes: ScoreNote[];
}

/**
 * 이 마디로 온 이유 — 연습에서 틀렸을 때 힌트로 쓴다.
 * pass-fine·pass-to-coda: 처음 지날 때라 Fine·To Coda를 지나쳤다. no-repeat: 되돌아온 뒤라 :‖를 반복하지 않았다.
 */
export type RoadmapVia =
  | "start" | "next" | "repeat" | "ending" | "dc" | "ds" | "coda"
  | "pass-fine" | "pass-to-coda" | "no-repeat";

export interface RoadmapStep {
  /** 마디 번호 (0부터) */
  measure: number;
  via: RoadmapVia;
  /** D.C./D.S.로 되돌아간 뒤인지 */
  afterJump: boolean;
  /** 지금 몇 번째로 지나는지 (반복 구간 안에서, 1부터) */
  pass: number;
}

export interface Roadmap {
  steps: RoadmapStep[];
  /** 끝난 곳: Fine에서, 또는 마지막 마디(끝세로줄)에서 */
  end: "fine" | "end";
}

/** 이어진 괄호 마디 묶음의 가장 큰 번호 (1. 2. → 2, 1.2. 3. → 3) */
function endingGroupMax(measures: RoadmapMeasure[], i: number): number {
  let lo = i, hi = i;
  while (lo > 0 && measures[lo - 1].ending?.length) lo--;
  while (hi < measures.length - 1 && measures[hi + 1].ending?.length) hi++;
  let max = 0;
  for (let k = lo; k <= hi; k++) max = Math.max(max, ...(measures[k].ending ?? []));
  return max;
}

export function playbackOrder(measures: RoadmapMeasure[]): Roadmap {
  const steps: RoadmapStep[] = [];
  const n = measures.length;
  const codaAt = measures.findIndex((m) => m.coda);
  const segnoAt = measures.findIndex((m) => m.segno);

  let i = 0;
  let via: RoadmapVia = "start";
  let sectionStart = 0; // :‖가 돌아갈 곳
  let pass = 1;
  let afterJump = false;
  let jump: JumpKind | null = null;
  let end: Roadmap["end"] = "end";

  // 무한 반복 방지 (잘못된 악보)
  for (let guard = 0; i < n && guard < 1000; guard++) {
    const m = measures[i];
    if (m.startRepeat && sectionStart !== i && !afterJump) {
      sectionStart = i;
      pass = 1;
    }
    // 괄호: 이번에 연주할 번호가 아니면 건너뛴다
    if (m.ending?.length) {
      const want = afterJump ? endingGroupMax(measures, i) : pass;
      if (!m.ending.includes(want)) {
        i++;
        via = "ending";
        continue;
      }
    }

    steps.push({ measure: i, via, afterJump, pass });
    const leavingEnding = () => {
      // 괄호를 지나 괄호 없는 마디로 나가면 반복 구간이 끝난 것
      if (m.ending?.length && i + 1 < n && !measures[i + 1].ending?.length) {
        sectionStart = i + 1;
        pass = 1;
      }
    };

    // 마디 끝의 표시: Fine → To Coda → :‖ → D.C./D.S. 순서로 본다
    if (m.fine) {
      if (afterJump && jump !== null && !jump.endsWith("al Coda")) {
        end = "fine";
        break;
      }
    }
    if (m.toCoda && afterJump && jump?.endsWith("al Coda") && codaAt >= 0) {
      i = codaAt;
      via = "coda";
      continue;
    }
    if (m.endRepeat) {
      if (afterJump) {
        leavingEnding();
        i++;
        via = "no-repeat";
        continue;
      }
      const times = typeof m.endRepeat === "number" ? m.endRepeat : m.ending?.length ? endingGroupMax(measures, i) : 2;
      if (pass < times) {
        pass++;
        i = sectionStart;
        via = "repeat";
        continue;
      }
      sectionStart = i + 1;
      pass = 1;
    }
    if (m.jump && jump === null) {
      jump = m.jump;
      afterJump = true;
      const toSegno = m.jump.startsWith("D.S.");
      i = toSegno && segnoAt >= 0 ? segnoAt : 0;
      via = toSegno ? "ds" : "dc";
      continue;
    }

    leavingEnding();
    via = m.fine && !afterJump ? "pass-fine" : m.toCoda && !afterJump ? "pass-to-coda" : "next";
    i++;
  }
  return { steps, end };
}
