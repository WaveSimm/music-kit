"use client";
import { useCallback, useEffect, useState } from "react";
import { getAudioEngine, type AudioEngine, type EngineStatus } from "../audio/engine";

/**
 * 공용 오디오 엔진과 상태. unlock()은 반드시 터치·클릭 핸들러 안에서 부른다(iOS).
 * 서버 렌더링 중에는 engine이 null.
 */
export function useAudioEngine(): { engine: AudioEngine | null; status: EngineStatus; unlock: () => Promise<void> } {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [status, setStatus] = useState<EngineStatus>("locked");

  useEffect(() => {
    const e = getAudioEngine();
    setEngine(e);
    setStatus(e.status);
    return e.onStatus(setStatus);
  }, []);

  const unlock = useCallback(async () => {
    await getAudioEngine().unlock();
  }, []);

  return { engine, status, unlock };
}
