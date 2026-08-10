import { cloneBoard, getBlockingTetrominoIds } from "./board";
import { generateLevel } from "./generator";
import { EventBus } from "../events/EventBus";
import type { GameState, LevelConfig } from "../types/game";

export class GameStore {
  state: GameState;
  private lastAnnouncedSecond: number;

  constructor(
    private readonly config: LevelConfig,
    private readonly events: EventBus,
    restoredState?: GameState,
    seed?: number,
  ) {
    this.state = restoredState ?? this.createState(seed);
    this.lastAnnouncedSecond = Math.ceil(this.state.remainingTime);
  }

  restart(seed?: number): void {
    this.state = this.createState(seed);
    this.lastAnnouncedSecond = Math.ceil(this.state.remainingTime);
    this.changed();
  }

  selectTetromino(id: string): void {
    if (this.state.status !== "playing") return;
    const tetromino = this.state.board.tetrominoes.find((piece) => piece.id === id);
    if (!tetromino) return;
    this.state.timerStarted = true;

    const blockers = getBlockingTetrominoIds(tetromino, this.state.board);
    if (blockers.length > 0) {
      this.state.penalties += 1;
      this.state.remainingTime = Math.max(0, this.state.remainingTime - this.config.penaltySeconds);
      this.events.emit({
        type: "tetromino:blocked",
        tetromino,
        blockers,
        penaltySeconds: this.config.penaltySeconds,
      });
      if (this.state.remainingTime <= 0) this.fail();
      else this.changed();
      return;
    }

    this.state.board.tetrominoes = this.state.board.tetrominoes.filter((piece) => piece.id !== id);
    this.events.emit({ type: "tetromino:removed", tetromino });

    if (this.state.board.tetrominoes.length === 0) this.complete();
    else this.changed();
  }

  tick(deltaSeconds: number): void {
    if (this.state.status !== "playing" || !this.state.timerStarted) return;
    this.state.elapsedTime += deltaSeconds;
    this.state.remainingTime = Math.max(0, this.state.remainingTime - deltaSeconds);
    const currentSecond = Math.ceil(this.state.remainingTime);

    if (this.state.remainingTime <= 0) {
      this.fail();
    } else if (currentSecond !== this.lastAnnouncedSecond) {
      this.lastAnnouncedSecond = currentSecond;
      this.changed();
    }
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    this.state.status = "paused";
    this.changed();
  }

  resume(): void {
    if (this.state.status !== "paused") return;
    this.state.status = "playing";
    this.changed();
  }

  private createState(seed?: number): GameState {
    const generated = generateLevel(this.config, seed);
    return {
      levelId: this.config.id,
      board: cloneBoard(generated.board),
      remainingTime: this.config.timeLimitSeconds,
      elapsedTime: 0,
      timerStarted: false,
      penalties: 0,
      status: "playing",
      seed: generated.seed,
    };
  }

  private complete(): void {
    this.state.status = "completed";
    this.changed();
    this.events.emit({ type: "level:completed", state: this.state });
  }

  private fail(): void {
    this.state.status = "failed";
    this.changed();
    this.events.emit({ type: "level:failed", state: this.state });
  }

  private changed(): void {
    this.events.emit({ type: "state:changed", state: this.state });
  }
}
