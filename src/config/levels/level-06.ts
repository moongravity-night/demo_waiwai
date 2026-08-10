import type { LevelConfig } from "../../types/game";

export const LEVEL_06: LevelConfig = {
  id: "level-06",
  number: 6,
  title: "Скорость",
  board: { width: 10, height: 20 },
  fill: 1,
  tetrominoTypes: ["I", "J", "L", "O", "S", "T", "Z"],
  tetrominoWeights: { I: 1, J: 1, L: 1, O: 1, S: 1, T: 1, Z: 1 },
  timeLimitSeconds: 20,
  penaltySeconds: 3,
  maxGenerationAttempts: 20,
};
