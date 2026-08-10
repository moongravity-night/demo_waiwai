import type { LevelConfig } from "../types/game";

export interface LevelIntroContent {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function getLevelIntroContent(level: LevelConfig): LevelIntroContent | undefined {
  if (level.number < 2) return undefined;
  return {
    eyebrow: `УРОВЕНЬ ${String(level.number).padStart(2, "0")}`,
    title: level.title,
    subtitle: "АНТИТЕТРИС",
  };
}
