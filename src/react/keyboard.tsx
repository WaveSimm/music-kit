"use client";
// 피아노 건반 — SVG. 손가락으로 누르기 좋게 실제 픽셀 크기로 그리고, 넓으면 가로로 스크롤한다.
// fit이면 건반 폭을 화면 폭에 맞춰 범위 전체를 한눈에 보여 준다.
import { useEffect, useRef, useState } from "react";

export interface KeyboardProps {
  /** 가장 낮은 음·높은 음 (MIDI). 흰 건반에서 시작·끝나도록 맞춘다 */
  low?: number;
  high?: number;
  /** 눌린 음 (진하게) */
  pressed?: number[];
  /** 표시할 음 (연하게 — 음계 등) */
  marked?: number[];
  /** 흰 건반 아래 글자: "c"는 C 건반만 C4처럼, "none"은 없음, 함수면 음마다 */
  labels?: "c" | "none" | ((midi: number) => string | undefined);
  /** 건반 위쪽의 작은 글자 (예: 컴퓨터 키보드의 키 "A") */
  keyHints?: (midi: number) => string | undefined;
  onPress?: (midi: number) => void;
  onRelease?: (midi: number) => void;
  /** 처음 화면 가운데에 둘 음 (기본 C4 = 60) */
  centerMidi?: number;
  pressedColor?: string;
  markedColor?: string;
  whiteWidth?: number;
  /** true면 흰 건반 폭을 감싸는 상자 폭에 맞춘다 (minWhiteWidth~maxWhiteWidth, 모자라면 스크롤) */
  fit?: boolean;
  minWhiteWidth?: number;
  maxWhiteWidth?: number;
  height?: number;
  className?: string;
}

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const isBlack = (m: number) => BLACK_PCS.has(((m % 12) + 12) % 12);

export function Keyboard({
  low = 48, high = 84, pressed = [], marked = [], labels = "c", keyHints, onPress, onRelease, centerMidi = 60,
  pressedColor = "#2563eb", markedColor = "#60a5fa", whiteWidth: fixedWhiteWidth = 40,
  fit = false, minWhiteWidth = 24, maxWhiteWidth = 56, height = 150, className,
}: KeyboardProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const lo = isBlack(low) ? low - 1 : low;
  const hi = isBlack(high) ? high + 1 : high;

  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);

  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!fit || !el) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  const whiteWidth = fit && boxWidth
    ? Math.min(maxWhiteWidth, Math.max(minWhiteWidth, Math.floor((boxWidth / whites.length) * 10) / 10))
    : fixedWhiteWidth;
  const width = whites.length * whiteWidth;
  const blackW = whiteWidth * 0.6;
  const blackH = height * 0.62;
  const whiteX = new Map(whites.map((m, i) => [m, i * whiteWidth]));

  useEffect(() => {
    const el = scroller.current;
    const x = whiteX.get(isBlack(centerMidi) ? centerMidi - 1 : centerMidi);
    if (el && x !== undefined) el.scrollLeft = Math.max(0, x - el.clientWidth / 2 + whiteWidth / 2);
    // 처음 그릴 때만 가운데로 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 눌린 음이 화면 밖이나 가장자리에 걸리면 (오선을 탭해서 바뀐 경우 등) 그 건반이 보이도록 스크롤한다
  const pressedKey = pressed.join(",");
  useEffect(() => {
    const el = scroller.current;
    const m = pressed[pressed.length - 1];
    if (!el || m === undefined) return;
    const x = whiteX.get(isBlack(m) ? m - 1 : m);
    if (x === undefined) return;
    const margin = whiteWidth;
    if (x < el.scrollLeft + margin || x + whiteWidth > el.scrollLeft + el.clientWidth - margin) {
      el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2 + whiteWidth / 2), behavior: "smooth" });
    }
    // 눌린 음이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressedKey]);

  const pressedSet = new Set(pressed);
  const markedSet = new Set(marked);
  const labelOf = (m: number) =>
    typeof labels === "function" ? labels(m) : labels === "c" && m % 12 === 0 ? `C${m / 12 - 1}` : undefined;

  const handlers = (m: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onPress?.(m);
    },
    onPointerUp: () => onRelease?.(m),
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.buttons) onRelease?.(m);
    },
  });

  return (
    <div ref={scroller} className={className} style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <svg
        width={width}
        height={height + 1}
        viewBox={`0 0 ${width} ${height + 1}`}
        style={{ display: "block", touchAction: "pan-x", userSelect: "none", WebkitUserSelect: "none" }}
        role="group"
        aria-label="피아노 건반"
      >
        {whites.map((m) => {
          const x = whiteX.get(m)!;
          const pressedNow = pressedSet.has(m);
          const label = labelOf(m);
          return (
            <g key={m} {...handlers(m)} style={{ cursor: "pointer" }}>
              <rect x={x + 0.5} y={0.5} width={whiteWidth - 1} height={height} rx={4} fill={pressedNow ? pressedColor : "#ffffff"} stroke="#9ca3af" />
              {/* 표시할 음(음계 등)은 건반 아래쪽 점으로 — 칠하면 장조에서 흰 건반이 모두 칠해진다 */}
              {markedSet.has(m) && !pressedNow && (
                <circle cx={x + whiteWidth / 2} cy={height - 30} r={5} fill={markedColor} style={{ pointerEvents: "none" }} />
              )}
              {keyHints?.(m) && (
                <text x={x + whiteWidth / 2} y={blackH + 18} textAnchor="middle" fontSize={11} fontWeight={600}
                  fill={pressedNow ? "#ffffff" : "#9ca3af"} style={{ pointerEvents: "none" }}>
                  {keyHints(m)}
                </text>
              )}
              {label && (
                <text x={x + whiteWidth / 2} y={height - 10} textAnchor="middle" fontSize={11}
                  fill={pressedSet.has(m) ? "#ffffff" : "#6b7280"} style={{ pointerEvents: "none" }}>
                  {label}
                </text>
              )}
            </g>
          );
        })}
        {whites.map((m) => {
          const b = m + 1;
          if (!isBlack(b) || b > hi) return null;
          const x = whiteX.get(m)! + whiteWidth - blackW / 2;
          const pressedNow = pressedSet.has(b);
          return (
            <g key={b} {...handlers(b)} style={{ cursor: "pointer" }}>
              <rect x={x} y={0} width={blackW} height={blackH} rx={3} fill={pressedNow ? pressedColor : "#1f2937"} stroke="#111827" />
              {markedSet.has(b) && !pressedNow && (
                <circle cx={x + blackW / 2} cy={blackH - 14} r={4} fill={markedColor} style={{ pointerEvents: "none" }} />
              )}
              {keyHints?.(b) && (
                <text x={x + blackW / 2} y={16} textAnchor="middle" fontSize={10} fontWeight={600}
                  fill="#d1d5db" style={{ pointerEvents: "none" }}>
                  {keyHints(b)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
