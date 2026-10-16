// 소리 샘플 공급원. 지금은 피아노(Magenta SoundFont sgm_plus)만, 나중에 육성(계명 음절) 샘플을 같은 인터페이스로 붙인다.

export interface VoiceSource {
  readonly id: string;
  readonly minMidi: number;
  readonly maxMidi: number;
  /** 이 음의 샘플(AudioBuffer). 같은 음은 한 번만 받는다. */
  load(ctx: BaseAudioContext, midi: number): Promise<AudioBuffer>;
  /** 오디오 컨텍스트 없이 파일만 미리 받아 둔다 (첫 터치 전에 호출 가능) */
  prefetch(midi: number): void;
}

/**
 * Magenta SoundFont 피아노 (html-midi-player 등 Magenta 기반 플레이어와 같은 음색).
 * 파일: {base}/acoustic_grand_piano/p{midi}_v{velocity}.mp3, 3초, 약 38KB, CORS 허용.
 */
export class SoundFontSource implements VoiceSource {
  readonly id: string;
  readonly minMidi = 21;
  readonly maxMidi = 108;
  private bytes = new Map<number, Promise<ArrayBuffer>>();
  private buffers = new Map<number, Promise<AudioBuffer>>();

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

  private fetchBytes(midi: number): Promise<ArrayBuffer> {
    let p = this.bytes.get(midi);
    if (!p) {
      p = fetch(this.url(midi)).then((r) => {
        if (!r.ok) throw new Error(`피아노 샘플을 받지 못했습니다 (MIDI ${midi}, HTTP ${r.status})`);
        return r.arrayBuffer();
      });
      p.catch(() => this.bytes.delete(midi));
      this.bytes.set(midi, p);
    }
    return p;
  }

  prefetch(midi: number): void {
    if (midi >= this.minMidi && midi <= this.maxMidi) void this.fetchBytes(midi).catch(() => {});
  }

  load(ctx: BaseAudioContext, midi: number): Promise<AudioBuffer> {
    if (midi < this.minMidi || midi > this.maxMidi) {
      return Promise.reject(new Error(`피아노 음역 밖입니다 (MIDI ${midi})`));
    }
    let p = this.buffers.get(midi);
    if (!p) {
      // decodeAudioData는 ArrayBuffer를 소모하므로 복사본을 넘긴다
      p = this.fetchBytes(midi).then((b) => ctx.decodeAudioData(b.slice(0)));
      p.catch(() => this.buffers.delete(midi));
      this.buffers.set(midi, p);
    }
    return p;
  }
}
