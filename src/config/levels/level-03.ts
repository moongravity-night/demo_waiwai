import type { LevelConfig } from "../../types/game";

export const LEVEL_03: LevelConfig = {
  id: "level-03",
  number: 3,
  title: "Угловые фигуры",
  board: { width: 10, height: 20 },
  fill: 0.5,
  tetrominoTypes: ["O", "I", "L", "J"],
  tetrominoWeights: { I: 1, J: 1, L: 1, O: 1, S: 0, T: 0, Z: 0 },
  timeLimitSeconds: 20,
  penaltySeconds: 3,
  maxGenerationAttempts: 160,
};
