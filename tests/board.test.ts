import { describe, expect, it } from "vitest";
import { canRemoveTetromino, findRemovalSequence, getBlockingTetrominoIds } from "../src/game/board";
import type { BoardState, Tetromino } from "../src/types/game";

function piece(id: string, cells: Array<[number, number]>): Tetromino {
  return {
    id,
    type: "I",
    placementOrder: 0,
    cells: cells.map(([x, y]) => ({ x, y })),
  };
}

describe("правило вертикального пути", () => {
  it("игнорирует клетки самой фигуры, но находит другую фигуру выше", () => {
    const lower = piece("lower", [[2, 10], [2, 11], [2, 12], [2, 13]]);
    const upper = piece("upper", [[2, 4], [3, 4], [4, 4], [5, 4]]);
    const board: BoardState = { width: 10, height: 20, tetrominoes: [lower, upper] };

    expect(canRemoveTetromino(lower, board)).toBe(false);
    expect(getBlockingTetrominoIds(lower, board)).toEqual(["upper"]);
    expect(canRemoveTetromino(upper, board)).toBe(true);
    expect(findRemovalSequence(board)).toEqual(["upper", "lower"]);
  });

  it("обнаруживает цикл взаимной блокировки", () => {
    const left = piece("left", [[1, 5], [2, 4], [3, 4], [4, 4]]);
    const right = piece("right", [[1, 4], [2, 5], [5, 5], [6, 5]]);
    const board: BoardState = { width: 10, height: 20, tetrominoes: [left, right] };

    expect(findRemovalSequence(board)).toBeNull();
  });
});
