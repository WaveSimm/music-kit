// 컴퓨터 키보드 → 피아노 건반 (가상 피아노에서 흔히 쓰는 배치)
//
//   W E   T Y U   O P        검은 건반
//  A S D F G H J K L ;       흰 건반 (A = 기준 C)
//  Z / X                     한 옥타브 아래 / 위
//
// KeyboardEvent.code(물리적 위치)로 읽는다. key(글자)는 한글 자판이 켜져 있으면 'ㅁ'처럼 들어와서 쓸 수 없다.

/** 기준 C로부터의 반음 거리 */
export const COMPUTER_KEY_OFFSETS: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
};

export const OCTAVE_DOWN_CODE = "KeyZ";
export const OCTAVE_UP_CODE = "KeyX";

/** 화면에 붙일 글자 */
const CODE_LABEL: Record<string, string> = { Semicolon: ";" };
export function computerKeyLabel(code: string): string {
  return CODE_LABEL[code] ?? code.replace(/^Key/, "");
}

/** 눌린 키 → MIDI. 피아노 키가 아니면 null. baseMidi는 A 키의 음(C여야 배치가 맞다). */
export function computerKeyToMidi(code: string, baseMidi: number): number | null {
  const off = COMPUTER_KEY_OFFSETS[code];
  return off === undefined ? null : baseMidi + off;
}

/** MIDI → 그 음을 내는 키 (건반 위에 글자를 표시할 때) */
export function midiToComputerKey(midi: number, baseMidi: number): string | null {
  const off = midi - baseMidi;
  const code = Object.keys(COMPUTER_KEY_OFFSETS).find((c) => COMPUTER_KEY_OFFSETS[c] === off);
  return code ?? null;
}

/** 옥타브 이동 결과. 범위를 넘으면 그대로 */
export function shiftComputerKeyBase(baseMidi: number, direction: -1 | 1, min = 24, max = 96): number {
  const next = baseMidi + 12 * direction;
  return next < min || next > max ? baseMidi : next;
}
