import type { LevelConfig } from "../../types/game";

export const LEVEL_02: LevelConfig = {
  id: "level-02",
  number: 2,
  title: "Базовый",
  board: { width: 10, height: 20 },
  fill: 0.5,
  tetrominoTypes: ["O", "I"],
  tetrominoWeights: { I: 1, J: 0, L: 0, O: 1, S: 0, T: 0, Z: 0 },
  timeLimitSeconds: 20,
  penaltySeconds: 3,
  maxGenerationAttempts: 160,
};
