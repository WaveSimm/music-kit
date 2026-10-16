// 소리 샘플 공급원. 피아노(Magenta SoundFont sgm_plus)와, URL 규칙으로 찾는 샘플 묶음(음절별 노래 소리 등).

export interface VoiceSource {
  readonly id: string;
  readonly minMidi: number;
  readonly maxMidi: number;
  /**
   * 이 음의 샘플(AudioBuffer). 같은 소리는 한 번만 받는다.
   * lyric은 노래 소리에서 부를 음절(계이름 등) — 피아노처럼 음절이 없는 소리는 무시한다.
   */
  load(ctx: BaseAudioContext, midi: number, lyric?: string): Promise<AudioBuffer>;
  /** 오디오 컨텍스트 없이 파일만 미리 받아 둔다 (첫 터치 전에 호출 가능) */
  prefetch(midi: number, lyric?: string): void;
}

/** URL별로 받은 바이트와 디코딩한 버퍼를 기억한다. 실패하면 다음에 다시 받는다. */
class SampleCache {
  private bytes = new Map<string, Promise<ArrayBuffer>>();
  private buffers = new Map<string, Promise<AudioBuffer>>();

  fetch(url: string): Promise<ArrayBuffer> {
    let p = this.bytes.get(url);
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`소리 샘플을 받지 못했습니다 (${url}, HTTP ${r.status})`);
        return r.arrayBuffer();
      });
      p.catch(() => this.bytes.delete(url));
      this.bytes.set(url, p);
    }
    return p;
  }

  decode(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
    let p = this.buffers.get(url);
    if (!p) {
      // decodeAudioData는 ArrayBuffer를 소모하므로 복사본을 넘긴다
      p = this.fetch(url).then((b) => ctx.decodeAudioData(b.slice(0)));
      p.catch(() => this.buffers.delete(url));
      this.buffers.set(url, p);
    }
    return p;
  }
}

/**
 * Magenta SoundFont 피아노 (html-midi-player 등 Magenta 기반 플레이어와 같은 음색).
 * 파일: {base}/acoustic_grand_piano/p{midi}_v{velocity}.mp3, 3초, 약 38KB, CORS 허용.
 */
export class SoundFontSource implements VoiceSource {
  readonly id: string;
  readonly minMidi = 21;
  readonly maxMidi = 108;
  private cache = new SampleCache();

  constructor(
    private readonly opts: {
      baseUrl?: string;
      instrument?: string;
      /** sgm_plus 피아노가 가진 세기: 15 31 47 63 79 95 111 127 */
      velocity?: number;
    } = {},
  ) {
    this.id = `soundfont:${opts.instrument ?? "acoustic_grand_piano"}`;
  }

  private url(midi: number): string {
    const base = this.opts.baseUrl ?? "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus";
    return `${base}/${this.opts.instrument ?? "acoustic_grand_piano"}/p${midi}_v${this.opts.velocity ?? 79}.mp3`;
  }

  prefetch(midi: number): void {
    if (midi >= this.minMidi && midi <= this.maxMidi) void this.cache.fetch(this.url(midi)).catch(() => {});
  }

  load(ctx: BaseAudioContext, midi: number): Promise<AudioBuffer> {
    if (midi < this.minMidi || midi > this.maxMidi) {
      return Promise.reject(new Error(`피아노 음역 밖입니다 (MIDI ${midi})`));
    }
    return this.cache.decode(ctx, this.url(midi));
  }
}

/**
 * URL 규칙으로 찾는 샘플 묶음 — 예: 음절 × 음높이별로 녹음하거나 합성한 노래 소리.
 * url(midi, lyric)이 null을 주거나, 음역 밖이거나, 파일을 받지 못하면 fallback(보통 피아노)으로 대신 울린다.
 */
export class UrlSampleSource implements VoiceSource {
  readonly id: string;
  readonly minMidi: number;
  readonly maxMidi: number;
  private cache = new SampleCache();

  constructor(
    private readonly opts: {
      id: string;
      minMidi: number;
      maxMidi: number;
      url: (midi: number, lyric?: string) => string | null;
      fallback?: VoiceSource;
    },
  ) {
    this.id = opts.id;
    this.minMidi = opts.minMidi;
    this.maxMidi = opts.maxMidi;
  }

  private urlFor(midi: number, lyric?: string): string | null {
    return midi >= this.minMidi && midi <= this.maxMidi ? this.opts.url(midi, lyric) : null;
  }

  prefetch(midi: number, lyric?: string): void {
    const url = this.urlFor(midi, lyric);
    if (url) void this.cache.fetch(url).catch(() => {});
    else this.opts.fallback?.prefetch(midi, lyric);
  }

  load(ctx: BaseAudioContext, midi: number, lyric?: string): Promise<AudioBuffer> {
    const { fallback } = this.opts;
    const url = this.urlFor(midi, lyric);
    if (!url) {
      return fallback
        ? fallback.load(ctx, midi, lyric)
        : Promise.reject(new Error(`이 소리 묶음에 없는 음입니다 (${this.id}, MIDI ${midi}${lyric ? `, ${lyric}` : ""})`));
    }
    const p = this.cache.decode(ctx, url);
    if (!fallback) return p;
    return p.catch((e) => {
      console.warn("[music-kit/audio]", e);
      return fallback.load(ctx, midi, lyric);
    });
  }
}
