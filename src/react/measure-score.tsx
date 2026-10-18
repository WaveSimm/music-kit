"use client";
// 마디가 있는 짧은 한 단 악보 — 세로줄·도돌이표·괄호(1. 2.)·세뇨·코다·To Coda·Fine·D.C./D.S.를 그리고,
// 마디를 누를 수 있다(악보 진행 연습용). SVG로 직접 그린다. 폭은 감싼 상자에 맞추고(좁으면 한 줄 4마디, 넓으면 8마디),
// 코다(𝄌)는 새 줄에서 시작한다. 마디 색·작은 글자·울리는 음표는 props로 받는다.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { GLYPHS, glyphScale, type GlyphName } from "../notation/glyphs";
import {
  CLEF_ANCHOR_STEP, accidentalFor, keySignatureSteps, ledgerSteps, staffStep,
  type AccidentalKind, type Clef,
} from "../notation/staff-layout";
import type { RoadmapMeasure, ScoreMeasure } from "../notation/roadmap";
import { toPitch } from "../theory/notes";

export interface MeasureScoreProps {
  measures: ScoreMeasure[];
  clef?: Clef;
  /** 조표: +샵 개수, -플랫 개수 */
  fifths?: number;
  /** 박자표 [위, 아래] — 첫 줄에만 쓴다 */
  time?: [number, number];
  /** 한 줄의 마디 수. 없으면 폭에 따라 (600px 미만 4마디, 이상 8마디) */
  perRow?: number;
  onTapMeasure?: (index: number) => void;
  /** 마디 배경색 (지나감·지금·틀림 같은 표시) */
  tint?: (index: number) => string | undefined;
  /** 이 마디를 지난 차례 번호들 — 마디 아래 파란 동그라미로 (예: [1, 5]) */
  visits?: (index: number) => number[];
  /** 울리고 있는 음표 */
  activeNote?: { measure: number; note: number } | null;
  activeColor?: string;
  /** 마디 번호 (기본 표시) */
  numbers?: boolean;
  ariaLabel?: string;
  className?: string;
}

const S = 8; // 줄 간격
const H = S / 2;
const NOTE_POINT = (39 * S) / 10;
const CLEF_POINT = (40 * S) / 10;
const TOP_PAD = 32; // 위: 세뇨·코다·글자(-19), 괄호(-12)
const BOTTOM_PAD = 26; // 아래: 기둥·덧줄, 마디 번호·작은 글자(+21)
const ROW_H = TOP_PAD + 4 * S + BOTTOM_PAD;
const ROW_GAP = 4;
const MARK_FONT = "'Times New Roman', Georgia, serif";

const ACC_GLYPH: Record<AccidentalKind, GlyphName> = {
  sharp: "sharp", flat: "flat", natural: "natural", doubleSharp: "doubleSharp", doubleFlat: "doubleFlat",
};

const widthOf = (name: GlyphName, point: number) => (GLYPHS[name].xMax - GLYPHS[name].xMin) * glyphScale(point);

function Glyph({ name, x, y, scale, fill }: { name: GlyphName; x: number; y: number; scale: number; fill?: string }) {
  return <path d={GLYPHS[name].d} transform={`translate(${x} ${y}) scale(${scale})`} fill={fill ?? "currentColor"} />;
}

/** 가운데가 (cx, cy)이고 높이가 h인 세뇨·코다 */
function CenteredSign({ name, cx, cy, h }: { name: "segno" | "coda"; cx: number; cy: number; h: number }) {
  const g = GLYPHS[name];
  const s = h / (g.yMax - g.yMin);
  return <Glyph name={name} x={cx - ((g.xMin + g.xMax) / 2) * s} y={cy - ((g.yMin + g.yMax) / 2) * s} scale={s} />;
}

/** 마디를 줄로 나눈다. 코다는 새 줄에서 시작 */
export function measureRows(measures: RoadmapMeasure[], perRow: number): number[][] {
  const rows: number[][] = [];
  measures.forEach((m, i) => {
    const cur = rows[rows.length - 1];
    if (!cur || cur.length >= perRow || (m.coda && cur.length > 0)) rows.push([i]);
    else cur.push(i);
  });
  return rows;
}

const endingKey = (m: RoadmapMeasure | undefined) => (m?.ending?.length ? m.ending.join(".") : "");

export function MeasureScore({
  measures, clef = "treble", fifths = 0, time = [4, 4], perRow, onTapMeasure, tint, visits,
  activeNote, activeColor = "#2563eb", numbers = true, ariaLabel, className,
}: MeasureScoreProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const per = perRow ?? (width >= 600 ? 8 : 4);
  const rows = measureRows(measures, per);
  const keySig = keySignatureSteps(fifths);
  const noteScale = glyphScale(NOTE_POINT);
  const clefName: GlyphName = clef === "treble" ? "trebleClef" : "bassClef";
  const clefW = widthOf(clefName, CLEF_POINT);
  const keyX = 4 + clefW + 6;
  const timeDigits = time.map((n) => String(n).split("").map((d) => `time${d}` as GlyphName));
  const timeW = Math.max(...timeDigits.map((ds) => ds.reduce((w, g) => w + widthOf(g, NOTE_POINT), 0)));
  const leftOf = (row: number) => keyX + keySig.length * 8 + (keySig.length ? 4 : 0) + (row === 0 ? timeW + 8 : 0) + 4;
  const height = rows.length * ROW_H + (rows.length - 1) * ROW_GAP;
  const headW = widthOf("noteheadBlack", NOTE_POINT);
  const wholeW = widthOf("noteheadWhole", NOTE_POINT);

  const out: ReactElement[] = [];
  rows.forEach((row, r) => {
    const rowTop = r * (ROW_H + ROW_GAP);
    const staffTop = rowTop + TOP_PAD;
    const staffBottom = staffTop + 4 * S;
    const yOf = (step: number) => staffBottom - step * H;
    const left = leftOf(r);
    const mw = (width - left - 2) / per;
    const rowEnd = left + row.length * mw;

    // 오선·음자리표·조표·박자표
    [0, 2, 4, 6, 8].forEach((s) => out.push(<line key={`l${r}-${s}`} x1={2} x2={rowEnd} y1={yOf(s)} y2={yOf(s)} stroke="currentColor" strokeWidth={0.9} />));
    out.push(<Glyph key={`c${r}`} name={clefName} x={4} y={yOf(CLEF_ANCHOR_STEP[clef])} scale={glyphScale(CLEF_POINT)} />);
    keySig.forEach((a, k) => out.push(<Glyph key={`k${r}-${k}`} name={a.kind} x={keyX + k * 8} y={yOf(a.step)} scale={noteScale} />));
    if (r === 0) {
      const tx = keyX + keySig.length * 8 + (keySig.length ? 4 : 0) + 2;
      timeDigits.forEach((ds, k) => {
        const w = ds.reduce((sum, g) => sum + widthOf(g, NOTE_POINT), 0);
        let x = tx + (timeW - w) / 2;
        ds.forEach((g, j) => {
          out.push(<Glyph key={`t${k}-${j}`} name={g} x={x} y={k === 0 ? yOf(4) : yOf(0)} scale={noteScale} />);
          x += widthOf(g, NOTE_POINT);
        });
      });
    }

    row.forEach((i, col) => {
      const m = measures[i];
      const mx = left + col * mw;
      const xR = mx + mw;
      const color = tint?.(i);
      if (color) out.push(<rect key={`bg${i}`} x={mx + 1} y={staffTop - 8} width={mw - 2} height={4 * S + 16} rx={6} fill={color} />);

      // 음표: 긴 음일수록 자리를 조금 더 (악보 조판처럼 박에 비례하되 차이를 줄인다). 한 음뿐이면 가운데
      const padL = 5 + (m.startRepeat ? 10 : 0);
      const padR = 4 + (m.endRepeat ? 10 : 0);
      const room = (beats: number) => Math.sqrt(beats);
      const total = m.notes.reduce((sum, n) => sum + room(n.beats), 0) || 1;
      let at = 0;
      m.notes.forEach((n, k) => {
        const p = toPitch(n.pitch);
        const step = staffStep(p, clef);
        const y = yOf(step);
        const head: GlyphName = n.beats >= 4 ? "noteheadWhole" : n.beats >= 2 ? "noteheadHalf" : "noteheadBlack";
        const w = head === "noteheadWhole" ? wholeW : headW;
        const x = m.notes.length === 1
          ? mx + (mw - w) / 2
          : mx + padL + (at / total) * (mw - padL - padR);
        at += room(n.beats);
        const fill = activeNote?.measure === i && activeNote.note === k ? activeColor : undefined;
        const acc = accidentalFor(p, fifths);
        out.push(
          <g key={`n${i}-${k}`} fill={fill ?? "currentColor"} stroke={fill ?? "currentColor"}>
            {ledgerSteps(step).map((s) => <line key={s} x1={x - 3} x2={x + w + 3} y1={yOf(s)} y2={yOf(s)} strokeWidth={1.1} />)}
            {acc && <Glyph name={ACC_GLYPH[acc]} x={x - widthOf(ACC_GLYPH[acc], NOTE_POINT) - 2} y={y} scale={noteScale} fill={fill} />}
            <Glyph name={head} x={x} y={y} scale={noteScale} fill={fill} />
            {n.beats < 4 && (step < 4
              ? <line x1={x + w - 0.6} x2={x + w - 0.6} y1={y - 1} y2={y - 3.5 * S} strokeWidth={1.1} />
              : <line x1={x + 0.6} x2={x + 0.6} y1={y + 1} y2={y + 3.5 * S} strokeWidth={1.1} />)}
            {(n.beats === 3 || n.beats === 1.5) && <circle cx={x + w + 3} cy={step % 2 === 0 ? y - H : y} r={1.4} stroke="none" />}
          </g>,
        );
      });

      // 세로줄 (마디 끝)
      const isLast = i === measures.length - 1;
      const thin = (x: number, k: string) => <line key={k} x1={x} x2={x} y1={staffTop} y2={staffBottom} stroke="currentColor" strokeWidth={1} />;
      const thick = (x: number, k: string) => <rect key={k} x={x} y={staffTop} width={3} height={4 * S} fill="currentColor" />;
      const dots = (x: number, k: string) => [3, 5].map((s) => <circle key={`${k}${s}`} cx={x} cy={yOf(s)} r={1.6} fill="currentColor" />);
      if (m.endRepeat) {
        out.push(...dots(xR - 10, `rd${i}`), thin(xR - 6, `rt${i}`), thick(xR - 3, `rk${i}`));
      } else {
        const bar = m.barline ?? (isLast ? "final" : "single");
        if (bar === "final") out.push(thin(xR - 6, `ft${i}`), thick(xR - 3, `fk${i}`));
        else if (bar === "double") out.push(thin(xR - 3, `dt${i}`), thin(xR, `dt2${i}`));
        else out.push(thin(xR, `st${i}`));
      }
      if (m.startRepeat) out.push(thick(mx, `sk${i}`), thin(mx + 6, `stn${i}`), ...dots(mx + 10, `sd${i}`));

      // 아래 왼편: 마디 번호 (위쪽은 기호·글자 자리)
      if (numbers) out.push(<text key={`num${i}`} x={mx + 3} y={staffBottom + 21} fontSize={9} fill="#9ca3af">{i + 1}</text>);
      // 위쪽 왼편: 세뇨·코다
      const lx = mx + 3;
      if (m.segno) out.push(<CenteredSign key={`sg${i}`} name="segno" cx={lx + 5} cy={staffTop - 23} h={15} />);
      if (m.coda) {
        out.push(<CenteredSign key={`cd${i}`} name="coda" cx={lx + 6} cy={staffTop - 23} h={14} />);
        out.push(<text key={`cdt${i}`} x={lx + 15} y={staffTop - 19} fontSize={11} fontWeight={700} fontFamily={MARK_FONT}>Coda</text>);
      }
      // 위쪽 오른편: To Coda · Fine · D.C./D.S.
      const marks = [m.fine && "Fine", m.jump].filter(Boolean).join(" ");
      if (m.toCoda) {
        out.push(<CenteredSign key={`tcs${i}`} name="coda" cx={xR - 7} cy={staffTop - 23} h={12} />);
        out.push(<text key={`tc${i}`} x={xR - 15} y={staffTop - 19} textAnchor="end" fontSize={10.5} fontStyle="italic" fontWeight={700} fontFamily={MARK_FONT}>To Coda</text>);
      } else if (marks) {
        out.push(
          <text key={`mk${i}`} x={xR - 2} y={staffTop - 19} textAnchor="end" fontSize={10.5} fontStyle="italic" fontWeight={700}
            fontFamily={MARK_FONT} stroke="white" strokeWidth={3} paintOrder="stroke">{marks}</text>,
        );
      }

      // 괄호 (같은 번호의 이어진 마디를 한 괄호로)
      const key = endingKey(m);
      if (key) {
        const first = col === 0 || endingKey(measures[row[col - 1]]) !== key;
        const last = col === row.length - 1 || endingKey(measures[row[col + 1]]) !== key;
        const y = staffTop - 12;
        const x1 = mx + (first ? 2 : 0);
        const x2 = xR - (last ? 4 : 0);
        const startsGroup = first && endingKey(measures[i - 1]) !== key;
        const closed = last && !!m.endRepeat;
        out.push(
          <path key={`v${i}`} d={`M${x1} ${startsGroup ? y + 9 : y} V${y} H${x2}${closed ? ` V${y + 9}` : ""}`}
            fill="none" stroke="currentColor" strokeWidth={1} />,
        );
        if (startsGroup) out.push(<text key={`vt${i}`} x={x1 + 3} y={y + 9} fontSize={10} fontWeight={700}>{key}.</text>);
      }

      const v = visits?.(i) ?? [];
      v.forEach((n, k) => {
        const cx = mx + mw / 2 + 4 + (k - (v.length - 1) / 2) * 15;
        out.push(
          <g key={`v${i}-${k}`}>
            <circle cx={cx} cy={staffBottom + 17} r={6.5} fill={activeColor} stroke="white" strokeWidth={1.5} />
            <text x={cx} y={staffBottom + 20} textAnchor="middle" fontSize={n > 9 ? 7.5 : 9} fontWeight={700} fill="white">{n}</text>
          </g>,
        );
      });

      if (onTapMeasure) {
        const tap = () => onTapMeasure(i);
        out.push(
          <rect key={`tap${i}`} x={mx} y={rowTop} width={mw} height={ROW_H} fill="transparent" role="button" tabIndex={0}
            aria-label={`${i + 1}마디`} style={{ cursor: "pointer", outline: "none" }} onClick={tap}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                tap();
              }
            }} />,
        );
      }
    });
  });

  return (
    <div ref={box} className={className} style={{ width: "100%" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={ariaLabel}
        style={{ display: "block", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
        {out}
      </svg>
    </div>
  );
}
