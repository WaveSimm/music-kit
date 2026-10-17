"use client";
// 오선 — SVG로 직접 그린다. 음표는 온음표 머리(기둥 없음), 조표·임시표·덧줄 표시, 탭하면 그 자리의 음.
import { useRef, useState, type PointerEvent } from "react";
import { GLYPHS, glyphScale, type GlyphName } from "../notation/glyphs";
import {
  CLEF_ANCHOR_STEP, accidentalFor, keySignatureSteps, ledgerSteps, pitchAtStep, staffStep,
  type AccidentalKind, type Clef,
} from "../notation/staff-layout";
import type { Pitch } from "../theory/notes";

export interface StaffNote {
  pitch: Pitch;
  /** 음표 아래 첫 줄 (예: "F#4") */
  label?: string;
  /** 음표 아래 둘째 줄 (예: 계명 "피") */
  sub?: string;
  highlight?: boolean;
  /** 이 음표만의 색 (예: 판정 결과). highlight가 우선 */
  color?: string;
}

export interface StaffProps {
  clef: Clef;
  /** 조표: +샵 개수, -플랫 개수 */
  fifths?: number;
  notes: StaffNote[];
  /** true면 모든 음을 한 자리에 (화음) */
  chord?: boolean;
  /** 음표 자리 최소 개수 (빈 오선의 폭) */
  minSlots?: number;
  /** 탭하면 그 자리의 음. 임시표는 조표를 따르고 tapAccidental로 바꿀 수 있다 */
  onTapPitch?: (pitch: Pitch) => void;
  tapAccidental?: "key" | "sharp" | "flat" | "natural";
  highlightColor?: string;
  /** 화면 읽기 프로그램용 설명 */
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SPACE = 10; // 줄 간격
const HALF = SPACE / 2;
const TOP = 40; // 기본 음역일 때 맨 위 줄 y
// 기본으로 자리를 잡아 두는 음역 (덧줄 3개씩). 음표가 더 벗어나면 그만큼 오선 위아래를 늘린다
const MIN_STEP = -6;
const MAX_STEP = 14;
const TAP_MIN = -8; // 탭으로 고를 수 있는 범위 (덧줄 4개)
const TAP_MAX = 16;
const SLOT = 44;
const NOTE_POINT = 39;
const CLEF_POINT = 40;

const ACC_GLYPH: Record<AccidentalKind, GlyphName> = {
  sharp: "sharp", flat: "flat", natural: "natural", doubleSharp: "doubleSharp", doubleFlat: "doubleFlat",
};

function glyphWidth(name: GlyphName, point: number) {
  const g = GLYPHS[name];
  return (g.xMax - g.xMin) * glyphScale(point);
}

function GlyphPath({ name, x, y, point, fill }: { name: GlyphName; x: number; y: number; point: number; fill?: string }) {
  const s = glyphScale(point);
  return <path d={GLYPHS[name].d} transform={`translate(${x} ${y}) scale(${s})`} fill={fill ?? "currentColor"} />;
}

export function Staff({
  clef, fifths = 0, notes, chord, minSlots = 1, onTapPitch, tapAccidental = "key",
  highlightColor = "#2563eb", ariaLabel, className, style,
}: StaffProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState<number | null>(null);

  const keySig = keySignatureSteps(fifths);
  const clefX = 6;
  const keyX = clefX + glyphWidth(clef === "treble" ? "trebleClef" : "bassClef", CLEF_POINT) + 8;
  const notesX = keyX + keySig.length * 10 + (keySig.length ? 10 : 4);
  const slots = Math.max(minSlots, chord ? 1 : notes.length + (onTapPitch && ghost !== null ? 1 : 0));
  const width = notesX + slots * SLOT + 8;
  const hasLabels = !chord && notes.some((n) => n.label || n.sub);
  const noteW = glyphWidth("noteheadWhole", NOTE_POINT);

  // 세로 배치: 가장 높은·낮은 음표에 맞춰 위아래 여백을 늘려 덧줄이 글자와 겹치지 않게 한다
  // (마우스를 올렸을 때의 미리보기 음표는 넣지 않는다 — 높이가 바뀌며 화면이 흔들린다)
  const steps = notes.map((n) => staffStep(n.pitch, clef));
  const hiStep = Math.max(MAX_STEP, ...steps);
  const loStep = Math.min(MIN_STEP, ...steps);
  const top = TOP + (hiStep - MAX_STEP) * HALF;
  const yOf = (step: number) => top + (8 - step) * HALF;
  const bottom = yOf(loStep) + 10;
  const labelY = bottom + 14;
  const height = hasLabels ? bottom + 38 : bottom + 2;

  const stepAt = (e: PointerEvent<SVGSVGElement>): number | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const { y } = pt.matrixTransform(ctm.inverse());
    const step = Math.round((yOf(0) - y) / HALF);
    return Math.min(TAP_MAX, Math.max(TAP_MIN, step));
  };

  const drawNote = (key: string, step: number, cx: number, pitch: Pitch | null, color?: string, opacity = 1) => {
    const x = cx - noteW / 2;
    const acc = pitch ? accidentalFor(pitch, fifths) : null;
    return (
      <g key={key} opacity={opacity}>
        {ledgerSteps(step).map((s) => (
          <line key={s} x1={x - 5} x2={x + noteW + 5} y1={yOf(s)} y2={yOf(s)} stroke="currentColor" strokeWidth={1.3} />
        ))}
        {acc && <GlyphPath name={ACC_GLYPH[acc]} x={x - glyphWidth(ACC_GLYPH[acc], NOTE_POINT) - 4} y={yOf(step)} point={NOTE_POINT} fill={color} />}
        <GlyphPath name="noteheadWhole" x={x} y={yOf(step)} point={NOTE_POINT} fill={color} />
      </g>
    );
  };

  // 화음: 2도로 붙은 음은 머리를 오른쪽으로 비켜 놓는다
  const chordOffsets = (() => {
    const sorted = notes.map((n, i) => ({ i, step: staffStep(n.pitch, clef) })).sort((a, b) => a.step - b.step);
    const off = new Map<number, number>();
    let prev: { step: number; shifted: boolean } | null = null;
    for (const n of sorted) {
      const shifted: boolean = !!prev && n.step - prev.step === 1 && !prev.shifted;
      off.set(n.i, shifted ? noteW : 0);
      prev = { step: n.step, shifted };
    }
    return off;
  })();

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ display: "block", width: "100%", maxWidth: width * 1.8, touchAction: "manipulation", cursor: onTapPitch ? "pointer" : undefined, ...style }}
      onPointerDown={onTapPitch ? (e) => {
        const step = stepAt(e);
        if (step !== null) onTapPitch(pitchAtStep(step, clef, fifths, tapAccidental));
      } : undefined}
      onPointerMove={onTapPitch ? (e) => {
        const step = e.pointerType === "mouse" ? stepAt(e) : null;
        setGhost(step !== null && step >= MIN_STEP && step <= MAX_STEP ? step : null);
      } : undefined}
      onPointerLeave={() => setGhost(null)}
    >
      {[0, 2, 4, 6, 8].map((s) => (
        <line key={s} x1={2} x2={width - 2} y1={yOf(s)} y2={yOf(s)} stroke="currentColor" strokeWidth={1} />
      ))}
      <GlyphPath name={clef === "treble" ? "trebleClef" : "bassClef"} x={clefX} y={yOf(CLEF_ANCHOR_STEP[clef])} point={CLEF_POINT} />
      {keySig.map((a, i) => (
        <GlyphPath key={i} name={a.kind} x={keyX + i * 10} y={yOf(a.step)} point={NOTE_POINT} />
      ))}

      {notes.map((n, i) => {
        const step = staffStep(n.pitch, clef);
        const cx = notesX + (chord ? 0 : i) * SLOT + SLOT / 2 + (chord ? chordOffsets.get(i) ?? 0 : 0);
        const color = n.highlight ? highlightColor : n.color;
        return (
          <g key={i}>
            {drawNote(`n${i}`, step, cx, n.pitch, color)}
            {!chord && n.label && (
              <text x={cx} y={labelY} textAnchor="middle" fontSize={12} fill={color ?? "currentColor"}>{n.label}</text>
            )}
            {!chord && n.sub && (
              <text x={cx} y={labelY + 17} textAnchor="middle" fontSize={14} fontWeight={700} fill={color ?? "currentColor"}>{n.sub}</text>
            )}
          </g>
        );
      })}

      {onTapPitch && ghost !== null && (
        drawNote("ghost", ghost, notesX + (chord ? 0 : notes.length) * SLOT + SLOT / 2, pitchAtStep(ghost, clef, fifths, tapAccidental), highlightColor, 0.35)
      )}
    </svg>
  );
}
