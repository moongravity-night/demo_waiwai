export const TETROMINO_TYPES = ["I", "J", "L", "O", "S", "T", "Z"] as const;

export type TetrominoType = (typeof TETROMINO_TYPES)[number];

export interface Cell {
  x: number;
  y: number;
}

export interface Tetromino {
  id: string;
  type: TetrominoType;
  cells: Cell[];
  placementOrder: number;
}

export interface BoardState {
  width: number;
  height: number;
  tetrominoes: Tetromino[];
}

export interface LevelConfig {
  id: string;
  number: number;
  title: string;
  board: {
    width: number;
    height: number;
  };
  fill: number;
  tetrominoTypes: readonly TetrominoType[];
  tetrominoWeights: Readonly<Record<TetrominoType, number>>;
  timeLimitSeconds: number;
  penaltySeconds: number;
  maxGenerationAttempts: number;
}

export type GameStatus = "playing" | "paused" | "completed" | "failed";

export interface GameState {
  levelId: string;
  board: BoardState;
  remainingTime: number;
  elapsedTime: number;
  timerStarted: boolean;
  penalties: number;
  status: GameStatus;
  seed: number;
}

export type GameEvent =
  | { type: "state:changed"; state: GameState }
  | { type: "tetromino:removed"; tetromino: Tetromino }
  | { type: "tetromino:blocked"; tetromino: Tetromino; blockers: string[]; penaltySeconds: number }
  | { type: "level:completed"; state: GameState }
  | { type: "level:failed"; state: GameState };
