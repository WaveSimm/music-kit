"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioEngine } from "../audio/engine";
import { MicError, PitchTracker, type PitchFrame, type TrackerOptions } from "../pitch/tracker";

export type MicStatus = "off" | "starting" | "on" | "error";

/**
 * 마이크 음높이 추적. start()는 반드시 터치·클릭 핸들러 안에서 부른다 (iOS 오디오 잠금 해제 + 권한 묻기).
 * 공용 오디오 엔진과 같은 AudioContext를 쓰므로 프레임 시각(t)을 재생 예약 시각과 바로 비교할 수 있다.
 * onFrame은 화면을 다시 그리지 않고 모든 프레임을 받을 때 (판정용 기록), frame은 화면 표시용 최신 값.
 */
export function usePitchTracker(opts: Omit<TrackerOptions, "onFrame"> & { onFrame?: (f: PitchFrame) => void } = {}) {
  const [status, setStatus] = useState<MicStatus>("off");
  const [error, setError] = useState<MicError | null>(null);
  const [frame, setFrame] = useState<PitchFrame | null>(null);
  const tracker = useRef<PitchTracker | null>(null);
  const onFrame = useRef(opts.onFrame);
  onFrame.current = opts.onFrame;
  const { intervalMs, fftSize, detect } = opts;

  const stop = useCallback(() => {
    if (!tracker.current) return;
    tracker.current.stop();
    tracker.current = null;
    getAudioEngine().setCapturing(false);
    setStatus("off");
    setFrame(null);
  }, []);

  const start = useCallback(async (): Promise<PitchTracker | null> => {
    const engine = getAudioEngine();
    if (tracker.current) return tracker.current;
    // 첫 await 전에: 오디오 세션을 녹음 겸용으로 바꾸고 잠금을 푼다 (터치 안에서만 되는 브라우저가 있다)
    engine.setCapturing(true);
    void engine.unlock().catch(() => {});
    setStatus("starting");
    setError(null);
    try {
      const t = await PitchTracker.open(engine.audioContext(), {
        intervalMs, fftSize, detect,
        onFrame: (f) => {
          setFrame(f);
          onFrame.current?.(f);
        },
      });
      tracker.current = t;
      // 마이크를 여는 동안 오디오가 멈췄던 브라우저를 위해 한 번 더 (녹음 중인 페이지는 터치 없이도 된다)
      void engine.unlock().catch(() => {});
      setStatus("on");
      return t;
    } catch (e) {
      engine.setCapturing(false);
      setError(e instanceof MicError ? e : new MicError("unknown", String(e)));
      setStatus("error");
      return null;
    }
  }, [intervalMs, fftSize, detect]);

  useEffect(() => () => {
    if (tracker.current) {
      tracker.current.stop();
      tracker.current = null;
      getAudioEngine().setCapturing(false);
    }
  }, []);

  return { status, error, frame, start, stop };
}
