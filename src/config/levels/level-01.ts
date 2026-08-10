import type { LevelConfig } from "../../types/game";

export const LEVEL_01: LevelConfig = {
  id: "level-01",
  number: 1,
  title: "Обучение",
  board: { width: 10, height: 20 },
  fill: 0.24,
  tetrominoTypes: ["O", "I"],
  tetrominoWeights: { I: 1, J: 0, L: 0, O: 1, S: 0, T: 0, Z: 0 },
  timeLimitSeconds: 20,
  penaltySeconds: 3,
  maxGenerationAttempts: 120,
};
