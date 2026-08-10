const SOUND_URLS = {
  removalClick: new URL(
    "../../_Anti-Tetris_Selected/01_piece_removal_layers/layer_1_soft_click.wav",
    import.meta.url,
  ).href,
  removalWood: new URL(
    "../../_Anti-Tetris_Selected/01_piece_removal_layers/layer_2_wood_release.wav",
    import.meta.url,
  ).href,
  removalWhoosh: new URL(
    "../../_Anti-Tetris_Selected/01_piece_removal_layers/layer_3_airy_whoosh.wav",
    import.meta.url,
  ).href,
  blocked: new URL("../../_Anti-Tetris_Selected/02_feedback/blocked_muted_knock.wav", import.meta.url).href,
  levelComplete: new URL(
    "../../_Anti-Tetris_Selected/03_level/level_complete_kalimba_up.wav",
    import.meta.url,
  ).href,
  failure: new URL("../../_Anti-Tetris_Selected/03_level/time_out_arp_down.wav", import.meta.url).href,
  button: new URL("../../_Anti-Tetris_Selected/04_ui/button_soft_percussion.wav", import.meta.url).href,
  restart: new URL("../../_Anti-Tetris_Selected/04_ui/restart_board_reset_wood.wav", import.meta.url).href,
  countdown: new URL(
    "../assets/audio/last_seconds_antique_clock_5s.wav",
    import.meta.url,
  ).href,
} as const;

interface PlayOptions {
  delayMs?: number;
  playbackRate?: number;
  volume: number;
}

export class AudioManager {
  enabled = true;
  private countdown?: HTMLAudioElement;
  private countdownWindowActive = false;
  private readonly activeSounds = new Set<HTMLAudioElement>();
  private readonly scheduledSounds = new Set<number>();
  private readonly preloadedSounds: HTMLAudioElement[];

  constructor() {
    this.preloadedSounds = Object.values(SOUND_URLS).map((url) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.load();
      return audio;
    });
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopAll();
    return this.enabled;
  }

  removal(): void {
    const variation = 0.97 + Math.random() * 0.06;
    this.play(SOUND_URLS.removalClick, { volume: 0.34 / 3, playbackRate: variation });
    this.play(SOUND_URLS.removalWood, { delayMs: 15, volume: 0.3 / 3, playbackRate: variation * 0.99 });
    this.play(SOUND_URLS.removalWhoosh, { delayMs: 45, volume: 0.13 / 3 });
  }

  blocked(): void {
    this.play(SOUND_URLS.blocked, { volume: 0.24 });
  }

  levelComplete(): void {
    this.play(SOUND_URLS.levelComplete, { volume: 0.42 });
  }

  campaignComplete(): void {
    this.play(SOUND_URLS.levelComplete, { volume: 0.46, playbackRate: 0.96 });
    this.play(SOUND_URLS.levelComplete, { delayMs: 210, volume: 0.3, playbackRate: 1.08 });
  }

  failure(): void {
    this.stopCountdown();
    this.play(SOUND_URLS.failure, { volume: 0.38 });
  }

  button(): void {
    this.play(SOUND_URLS.button, { volume: 0.2 });
  }

  restart(): void {
    this.stopCountdown();
    this.play(SOUND_URLS.restart, { volume: 0.32 });
  }

  syncCountdown(active: boolean): void {
    if (!active || !this.enabled) {
      this.stopCountdown();
      return;
    }
    if (this.countdownWindowActive) return;

    this.countdownWindowActive = true;
    const countdown = this.createAudio(SOUND_URLS.countdown, 0.16);
    this.countdown = countdown;
    const release = (): void => {
      if (this.countdown === countdown) this.countdown = undefined;
    };
    countdown.addEventListener("ended", release, { once: true });
    countdown.addEventListener("error", release, { once: true });
    void countdown.play().catch(() => {
      release();
    });
  }

  destroy(): void {
    this.stopAll();
    for (const audio of this.preloadedSounds) {
      audio.removeAttribute("src");
      audio.load();
    }
  }

  private play(url: string, options: PlayOptions): void {
    if (!this.enabled) return;

    const start = (): void => {
      if (!this.enabled) return;
      const audio = this.createAudio(url, options.volume, options.playbackRate);
      this.activeSounds.add(audio);
      const cleanup = (): void => {
        this.activeSounds.delete(audio);
      };
      audio.addEventListener("ended", cleanup, { once: true });
      audio.addEventListener("error", cleanup, { once: true });
      void audio.play().catch(cleanup);
    };

    if (!options.delayMs) {
      start();
      return;
    }

    const timer = window.setTimeout(() => {
      this.scheduledSounds.delete(timer);
      start();
    }, options.delayMs);
    this.scheduledSounds.add(timer);
  }

  private createAudio(url: string, volume: number, playbackRate = 1): HTMLAudioElement {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    return audio;
  }

  private stopCountdown(): void {
    this.countdownWindowActive = false;
    if (!this.countdown) return;
    this.countdown.pause();
    this.countdown.currentTime = 0;
    this.countdown = undefined;
  }

  private stopAll(): void {
    this.stopCountdown();
    for (const timer of this.scheduledSounds) window.clearTimeout(timer);
    this.scheduledSounds.clear();
    for (const audio of this.activeSounds) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.activeSounds.clear();
  }
}
