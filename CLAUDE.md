# music-kit — 악보·음향·오디오 공용 도구

여러 프로젝트가 함께 쓰는 TypeScript 라이브러리. 악보·음향·오디오를 다루는 범용 코드는 여기에 모은다.
앱 고유 로직(DB, 라우트, 인증, 진도 규칙, 앱별 연습 음역 같은 정책)은 넣지 않는다.

**공개 저장소다** (GitHub WaveSimm/music-kit, public). 다른 비공개 프로젝트의 이름·경로·구조, 계정·DB 정보, 개인 메모를 커밋하지 말 것.

## 모듈

| 경로 | import | 내용 |
|---|---|---|
| `src/theory` | `@wavesimm/music-kit/theory` | 음이름·MIDI·주파수, 조표, 이동도 계명, 음계, 음정·화음 (순수 함수) |
| `src/notation` | `@wavesimm/music-kit/notation` | 오선 위치 계산, VexFlow 글리프(SVG path), 컴퓨터 키보드 배치 |
| `src/audio` | `@wavesimm/music-kit/audio` | Web Audio 엔진(싱글턴), Magenta SoundFont 피아노, `UrlSampleSource`(음 × 음절 샘플 묶음, 없으면 fallback), 재생 시간 계산 |
| `src/pitch` | `@wavesimm/music-kit/pitch` | 음높이 검출(pitchy, 순수), 판정 `judgeSing`(순수), 마이크 `PitchTracker`(브라우저 전용, 추적 + MediaRecorder 녹음) |
| `src/react` | `@wavesimm/music-kit/react` | `Staff`, `Keyboard`, `useAudioEngine`, `useComputerKeyboard`, `usePitchTracker` |

## 규칙

- **빌드 없이 TypeScript 원본을 내보낸다** (`package.json` exports → `.ts`). 쓰는 앱이 컴파일한다: Next.js는 `transpilePackages: ["@wavesimm/music-kit"]`.
- **pitchy는 peerDependency** (+ 테스트용 devDependency). 쓰는 앱이 설치한다 — 형제 폴더 링크·태그 clone 배포에서 이 저장소의 node_modules는 없기 때문.
- 마이크: 엔진과 같은 AudioContext를 쓴다(프레임 시각 = 재생 예약 시각). 마이크를 여는 동안 `engine.setCapturing(true)` — iOS 오디오 세션을 `play-and-record`로.
- **React는 peerDependency만.** 이 저장소에 react 런타임을 설치하지 말 것 (쓰는 앱과 React가 두 벌이 되어 hooks가 깨진다). 타입은 `@types/react`.
- **Tailwind를 쓰지 않는다.** 컴포넌트는 SVG 속성·인라인 스타일·`currentColor`로 그리고 `className`을 받는다.
- 한국어 표기: 음이름은 영문(C#, Bb), 계명은 도·레·미·파·솔·라·**티**, 반음계 올림 디·리·피·시·리 / 내림 라·메·세·레·테, 단조는 라부터. 한글이 겹치는 음절(ra/la, ri/li, re/le)은 영문 id로 구분.
- 순수 함수는 Vitest 테스트를 같이 둔다 (`*.test.ts`). `npm test`, `npm run typecheck`.
- 브라우저 전용 코드(audio, react)는 모듈 최상위에서 `window`를 건드리지 않는다 (SSR에서 import될 수 있음).
- Vitest는 3.x로 고정: Vitest 5(vite 8 + rolldown)는 npm 11에서 lockfile의 플랫폼 바이너리가 빠지는 문제가 있었다.

## 쓰는 프로젝트와 버전

- 로컬 개발: 쓰는 앱이 `"@wavesimm/music-kit": "file:../music-kit"` (형제 폴더 심볼릭 링크) — 고치면 바로 반영.
- 배포: 쓰는 앱의 설치 단계가 이 저장소의 **태그**(예: `v0.1.0`)를 `../music-kit`에 받아 온다. 쓰는 앱이 필요로 하는 변경을 push한 뒤에는 **새 태그를 달고**, 쓰는 앱의 태그 지정 파일을 올려야 배포에 반영된다.
- 태그: `git tag v0.x.y && git push origin v0.x.y`. `package.json` version도 같이 올린다.

## 출처·라이선스

- `src/notation/glyphs.ts`: VexFlow 1.2.93 글꼴에서 추출 (MIT, `THIRD_PARTY_NOTICES.md`). 재생성 스크립트 `scripts/extract-vexflow-glyphs.mjs`.
- 피아노 샘플: Magenta SoundFont `sgm_plus` (storage.googleapis.com/magentadata) — 재생 시 불러오며 저장소에 넣지 않는다.
