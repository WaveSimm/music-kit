// VexFlow 1.2.93 글꼴 윤곽선 → SVG path. 사용: vexflow/src/fonts/vexflow_font.js를 .mjs로 복사한 뒤
// node scripts/extract-vexflow-glyphs.mjs <복사한 vexflow_font.mjs> src/notation/glyphs.ts
// (글꼴 윤곽선은 y 위쪽 +, SVG path는 y 아래쪽 +)
import { readFileSync, writeFileSync } from "node:fs";
const [, , fontPath, outPath] = process.argv;
const { pathToFileURL } = await import("node:url");
const json = (await import(pathToFileURL(fontPath).href)).Font;
const want = {
  trebleClef: "v83", bassClef: "v79", noteheadBlack: "vb", noteheadHalf: "v81", noteheadWhole: "v1d",
  sharp: "v18", flat: "v44", natural: "v4e", doubleSharp: "v7f", doubleFlat: "v26",
  segno: "v8c", coda: "v4d",
  time0: "v0", time1: "v1", time2: "v2", time3: "v3", time4: "v4", time5: "v5", time6: "v6", time7: "v7", time8: "v8", time9: "v9",
};
const r = (n) => Math.round(Number(n) * 10) / 10;
const out = {};
for (const [name, code] of Object.entries(want)) {
  const g = json.glyphs[code];
  const t = g.o.trim().split(/\s+/);
  let d = "", i = 0, open = false, minY = Infinity, maxY = -Infinity;
  const y = (v) => { const n = -Number(v); minY = Math.min(minY, n); maxY = Math.max(maxY, n); return r(n); };
  while (i < t.length) {
    const c = t[i++];
    if (c === "m") { if (open) d += "Z"; d += `M${r(t[i])} ${y(t[i + 1])}`; i += 2; open = true; }
    else if (c === "l") { d += `L${r(t[i])} ${y(t[i + 1])}`; i += 2; }
    else if (c === "q") { d += `Q${r(t[i + 2])} ${y(t[i + 3])} ${r(t[i])} ${y(t[i + 1])}`; i += 4; }
    else if (c === "b") { d += `C${r(t[i + 2])} ${y(t[i + 3])} ${r(t[i + 4])} ${y(t[i + 5])} ${r(t[i])} ${y(t[i + 1])}`; i += 6; }
    else throw new Error(`알 수 없는 명령 ${c} (${code})`);
  }
  if (open) d += "Z";
  out[name] = { d, xMin: r(g.x_min), xMax: r(g.x_max), yMin: r(minY), yMax: r(maxY) };
}
const body = Object.entries(out).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join("\n");
writeFileSync(outPath, `// 악보 글리프 — VexFlow 1.2.93 글꼴(vexflow_font.js)에서 추출해 SVG path로 변환.
// VexFlow © Mohit Muthanna Cheppudira, MIT License (https://github.com/0xfe/vexflow).
// 좌표는 글꼴 단위(1000 = 1em), y는 아래쪽이 +. 원점은 VexFlow와 같다:
// 음자리표는 기준선(높은음자리표 G4선, 낮은음자리표 F3선), 음표 머리·임시표는 음 높이의 중앙선,
// 박자표 숫자(time0~9)는 숫자의 아랫단, 세뇨·코다는 그림의 가운데.
// 크기: VexFlow 관례대로 선 간격 10px일 때 scale = point * 72 / (1000 * 100), 음자리표 point 40, 나머지 39.
// 다시 만들기: scripts/extract-vexflow-glyphs.mjs (사용법은 스크립트 첫 줄).

export interface Glyph {
  d: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const GLYPHS = {
${body}
} satisfies Record<string, Glyph>;

export type GlyphName = keyof typeof GLYPHS;

export function glyphScale(point: number): number {
  return (point * 72) / (1000 * 100);
}
`);
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, `${v.d.length}자 x ${v.xMin}~${v.xMax} y ${v.yMin}~${v.yMax}`])));
