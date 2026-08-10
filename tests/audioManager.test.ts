import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "../src/audio/AudioManager";

class FakeAudio {
  static instances: FakeAudio[] = [];

  currentTime = 0;
  playbackRate = 1;
  preload = "";
  src = "";
  volume = 1;
  paused = false;
  playCount = 0;

  constructor(src = "") {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(): void {}
  load(): void {}
  removeAttribute(): void {
    this.src = "";
  }
  pause(): void {
    this.paused = true;
  }
  play(): Promise<void> {
    this.playCount += 1;
    return Promise.resolve();
  }
}

describe("AudioManager countdown", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts one countdown track and stops it when the warning becomes inactive", () => {
    const manager = new AudioManager();
    manager.syncCountdown(false);
    expect(FakeAudio.instances.filter((audio) => audio.playCount > 0)).toHaveLength(0);

    manager.syncCountdown(true);
    manager.syncCountdown(true);
    const playing = FakeAudio.instances.filter((audio) => audio.playCount > 0);
    expect(playing).toHaveLength(1);

    manager.syncCountdown(false);
    expect(playing[0]?.paused).toBe(true);
    expect(playing[0]?.currentTime).toBe(0);
  });

  it("stops the countdown when sound is disabled", () => {
    const manager = new AudioManager();
    manager.syncCountdown(true);
    const countdown = FakeAudio.instances.find((audio) => audio.playCount > 0);

    expect(manager.toggle()).toBe(false);
    expect(countdown?.paused).toBe(true);
  });
});
