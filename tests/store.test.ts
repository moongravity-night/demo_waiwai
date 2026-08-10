import { describe, expect, it } from "vitest";
import { EventBus } from "../src/events/EventBus";
import { findRemovalSequence, getBlockingTetrominoIds } from "../src/game/board";
import { GameStore } from "../src/game/GameStore";
import { LEVEL_01 } from "../src/config/levels/level-01";
import type { GameEvent } from "../src/types/game";

describe("GameStore", () => {
  it("запускает таймер только после первого клика по фигуре", () => {
    const events = new EventBus();
    const store = new GameStore(LEVEL_01, events, undefined, 42);
    const initialTime = store.state.remainingTime;

    store.tick(5);
    expect(store.state.timerStarted).toBe(false);
    expect(store.state.remainingTime).toBe(initialTime);
    expect(store.state.elapsedTime).toBe(0);

    store.selectTetromino(store.state.board.tetrominoes[0]!.id);
    const timeAfterClick = store.state.remainingTime;
    expect(store.state.timerStarted).toBe(true);

    store.tick(1);
    expect(store.state.remainingTime).toBeCloseTo(timeAfterClick - 1);
    expect(store.state.elapsedTime).toBeCloseTo(1);
  });

  it("применяет штраф к заблокированной фигуре", () => {
    const events = new EventBus();
    const received: GameEvent[] = [];
    events.subscribe((event) => received.push(event));
    const store = new GameStore(LEVEL_01, events, undefined, 42);
    const target = store.state.board.tetrominoes.find(
      (piece) => getBlockingTetrominoIds(piece, store.state.board).length > 0,
    );
    expect(target).toBeDefined();

    const before = store.state.remainingTime;
    store.selectTetromino(target!.id);
    const blockedEvent = received.find((event) => event.type === "tetromino:blocked");
    expect(blockedEvent).toBeDefined();
    expect(store.state.remainingTime).toBe(before - LEVEL_01.penaltySeconds);
  });

  it("завершает уровень при удалении в корректном порядке", () => {
    const events = new EventBus();
    const store = new GameStore(LEVEL_01, events, undefined, 2026);
    const sequence = findRemovalSequence(store.state.board)!;
    for (const id of sequence) store.selectTetromino(id);

    expect(store.state.board.tetrominoes).toHaveLength(0);
    expect(store.state.status).toBe("completed");
  });
});
