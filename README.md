# @wavesimm/music-kit

악보·음향·오디오 공용 도구 (TypeScript). 음악이론 계산, 오선 그리기, 피아노 소리 재생, React 오선·건반 컴포넌트.
한국어 사용자를 위한 표기(이동도 계명, 한국어 음정·화음 이름)를 기본으로 한다.

```ts
import { solfegeFor, scaleNotes, intervalName, chordType } from "@wavesimm/music-kit/theory";
import { getAudioEngine } from "@wavesimm/music-kit/audio";
import { Staff, Keyboard, useAudioEngine, useComputerKeyboard } from "@wavesimm/music-kit/react";

solfegeFor("F#4", "G major").ko;          // "티"
scaleNotes("D", "major");                 // D4 E4 F#4 G4 A4 B4 C#5 D5
intervalName("C4", "F#4");                // "증4도"
chordType(["E4", "G4", "C5"])?.label;     // "C 장3화음 1전위"
```

## 모듈

| import | 내용 |
|---|---|
| `@wavesimm/music-kit/theory` | 음이름·MIDI·주파수, 조표, 이동도 계명, 음계, 음정·화음, 음역에 맞춘 옥타브 (순수 함수) |
| `@wavesimm/music-kit/notation` | 오선 위치 계산, 악보 글리프(SVG path), 컴퓨터 키보드 배치 |
| `@wavesimm/music-kit/audio` | Web Audio 엔진, SoundFont 피아노 샘플, URL 규칙 샘플 묶음(음절별 노래 소리 등), 재생 시간 계산 |
| `@wavesimm/music-kit/react` | `Staff`, `Keyboard`, `useAudioEngine`, `useComputerKeyboard` |

## 쓰는 법

빌드 없이 TypeScript 원본을 내보낸다. 쓰는 앱이 컴파일한다.

- Next.js: `transpilePackages: ["@wavesimm/music-kit"]`
- React는 peer dependency (`>=18`). Tailwind 등 CSS 설정은 필요 없다.

## 개발

```bash
npm install
npm test           # vitest
npm run typecheck
```

## 출처

- 악보 글리프(`src/notation/glyphs.ts`): [VexFlow](https://github.com/0xfe/vexflow) 1.2.93 글꼴에서 추출 — MIT, [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- 피아노 소리: [Magenta](https://github.com/magenta/magenta-js) SoundFont `sgm_plus` (Google 저장소에서 재생 시 불러옴)
