import type { LevelConfig } from "../../types/game";

export const LEVEL_05: LevelConfig = {
  id: "level-05",
  number: 5,
  title: "Полный стакан",
  board: { width: 10, height: 20 },
  fill: 1,
  tetrominoTypes: ["I", "J", "L", "O", "S", "T", "Z"],
  tetrominoWeights: { I: 1, J: 1, L: 1, O: 1, S: 1, T: 1, Z: 1 },
  timeLimitSeconds: 30,
  penaltySeconds: 3,
  maxGenerationAttempts: 20,
};
