import { LEVEL_01 } from "./level-01";
import { LEVEL_02 } from "./level-02";
import { LEVEL_03 } from "./level-03";
import { LEVEL_04 } from "./level-04";
import { LEVEL_05 } from "./level-05";
import { LEVEL_06 } from "./level-06";
import type { LevelConfig } from "../../types/game";

export const LEVELS: readonly LevelConfig[] = [LEVEL_01, LEVEL_02, LEVEL_03, LEVEL_04, LEVEL_05, LEVEL_06];

export function getLevelById(levelId: string): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === levelId);
}

export function getNextLevel(levelId: string): LevelConfig | undefined {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  return index >= 0 ? LEVELS[index + 1] : undefined;
}

export function getFirstIncompleteLevel(completedLevelIds: readonly string[]): LevelConfig {
  return LEVELS.find((level) => !completedLevelIds.includes(level.id)) ?? LEVELS[0]!;
}

export function getCompletedLevels(completedLevelIds: readonly string[]): LevelConfig[] {
  const completedIds = new Set(completedLevelIds);
  return LEVELS.filter((level) => completedIds.has(level.id));
}
