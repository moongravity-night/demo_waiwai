import type { LevelConfig } from "../../types/game";

export const LEVEL_04: LevelConfig = {
  id: "level-04",
  number: 4,
  title: "Все фигуры",
  board: { width: 10, height: 20 },
  fill: 0.5,
  tetrominoTypes: ["I", "J", "L", "O", "S", "T", "Z"],
  tetrominoWeights: { I: 1, J: 1, L: 1, O: 1, S: 1, T: 1, Z: 1 },
  timeLimitSeconds: 20,
  penaltySeconds: 3,
  maxGenerationAttempts: 160,
};
