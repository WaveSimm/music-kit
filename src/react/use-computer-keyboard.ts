"use client";
// 컴퓨터 키보드로 건반 치기. 입력칸에 글자를 칠 때나 단축키(Ctrl·Cmd·Alt)는 건드리지 않는다.
import { useEffect, useRef, useState } from "react";
import {
  OCTAVE_DOWN_CODE, OCTAVE_UP_CODE, computerKeyLabel, computerKeyToMidi, midiToComputerKey, shiftComputerKeyBase,
} from "../notation/computer-keys";

export interface ComputerKeyboardOptions {
  onPress: (midi: number) => void;
  onRelease?: (midi: number) => void;
  /** A 키의 음 (기본 C4 = 60). 바뀌면 따라간다 */
  baseMidi?: number;
  /** 칠 수 있는 범위 (화면 건반과 맞춘다). 밖의 키는 무시하고, Z/X 옥타브 이동도 이 안에서만 */
  minMidi?: number;
  maxMidi?: number;
  enabled?: boolean;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** 마우스·키보드가 있는 기기인지 (휴대폰에서는 건반 글자를 숨기는 데 쓴다) */
export function useHasPhysicalKeyboard(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHas(mq.matches);
    const on = () => setHas(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return has;
}

export function useComputerKeyboard({
  onPress, onRelease, baseMidi = 60, minMidi = 21, maxMidi = 108, enabled = true,
}: ComputerKeyboardOptions) {
  const [base, setBase] = useState(baseMidi);
  useEffect(() => setBase(baseMidi), [baseMidi]);

  // 최신 콜백·기준음을 리스너 재등록 없이 쓰기 위해 ref에 둔다
  const latest = useRef({ onPress, onRelease, base, minMidi, maxMidi });
  latest.current = { onPress, onRelease, base, minMidi, maxMidi };
  const held = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.code === OCTAVE_DOWN_CODE || e.code === OCTAVE_UP_CODE) {
        // A 키(C)는 범위의 가장 낮은 음이 든 옥타브의 C부터, 가장 높은 음이 든 옥타브의 C까지
        const { minMidi: lo, maxMidi: hi } = latest.current;
        setBase((b) => shiftComputerKeyBase(b, e.code === OCTAVE_UP_CODE ? 1 : -1, lo - (lo % 12), hi - (hi % 12)));
        e.preventDefault();
        return;
      }
      const midi = computerKeyToMidi(e.code, latest.current.base);
      if (midi === null || midi < latest.current.minMidi || midi > latest.current.maxMidi) return;
      e.preventDefault();
      held.current.set(e.code, midi);
      latest.current.onPress(midi);
    };
    const up = (e: KeyboardEvent) => {
      const midi = held.current.get(e.code);
      if (midi === undefined) return;
      held.current.delete(e.code);
      latest.current.onRelease?.(midi);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled]);

  /** 건반 위에 표시할 키 글자 */
  const labelFor = (midi: number): string | undefined => {
    if (midi < minMidi || midi > maxMidi) return undefined;
    const code = midiToComputerKey(midi, base);
    return code ? computerKeyLabel(code) : undefined;
  };

  return { baseMidi: base, setBaseMidi: setBase, labelFor };
}
