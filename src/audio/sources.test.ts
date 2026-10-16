import { afterEach, describe, expect, it, vi } from "vitest";
import { UrlSampleSource, type VoiceSource } from "./sources";

// 디코딩 대신 받은 바이트의 첫 글자를 꼬리표로 돌려준다
const ctx = {
  decodeAudioData: async (b: ArrayBuffer) => ({ tag: new TextDecoder().decode(b) }) as unknown as AudioBuffer,
} as unknown as BaseAudioContext;

function stubFetch(missing: string[] = []) {
  const fn = vi.fn(async (url: string) =>
    missing.includes(url)
      ? new Response(null, { status: 404 })
      : new Response(new TextEncoder().encode(url)),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

const piano: VoiceSource = {
  id: "piano",
  minMidi: 0,
  maxMidi: 127,
  load: async (_ctx, midi) => ({ tag: `piano${midi}` }) as unknown as AudioBuffer,
  prefetch: () => {},
};

const tag = (b: AudioBuffer) => (b as unknown as { tag: string }).tag;

const sung = (fallback?: VoiceSource) =>
  new UrlSampleSource({
    id: "sung",
    minMidi: 55,
    maxMidi: 79,
    url: (midi, lyric) => (lyric ? `/voices/${lyric}${midi}.mp3` : null),
    fallback,
  });

afterEach(() => vi.unstubAllGlobals());

describe("UrlSampleSource", () => {
  it("음과 음절로 파일을 찾고, 같은 파일은 한 번만 받는다", async () => {
    const fetch = stubFetch();
    const src = sung();
    expect(tag(await src.load(ctx, 60, "do"))).toBe("/voices/do60.mp3");
    await src.load(ctx, 60, "do");
    expect(tag(await src.load(ctx, 60, "sol"))).toBe("/voices/sol60.mp3");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("음역 밖·음절 없음·받기 실패는 fallback으로 울린다", async () => {
    stubFetch(["/voices/mi64.mp3"]);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const src = sung(piano);
    expect(tag(await src.load(ctx, 40, "do"))).toBe("piano40");
    expect(tag(await src.load(ctx, 60))).toBe("piano60");
    expect(tag(await src.load(ctx, 64, "mi"))).toBe("piano64");
  });

  it("fallback이 없으면 거절한다", async () => {
    stubFetch();
    await expect(sung().load(ctx, 40, "do")).rejects.toThrow("MIDI 40");
  });
});
