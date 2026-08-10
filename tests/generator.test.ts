import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/config/levels";
import { findRemovalSequence, getBlockingTetrominoIds } from "../src/game/board";
import { generateLevel } from "../src/game/generator";
import { TETROMINO_ORIENTATIONS } from "../src/game/tetrominoes";
import type { Cell, TetrominoType } from "../src/types/game";

function normalizedShapeKey(cells: readonly Cell[]): string {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((cell) => `${cell.x},${cell.y}`)
    .join(";");
}

describe("генератор кампании", () => {
  it.each(LEVELS)("создаёт валидный и разбираемый стакан для $id", (level) => {
    const { board } = generateLevel(level, 2026);
    const occupied = new Set<string>();
    const counts = new Map<TetrominoType, number>();
    const expectedPieceCount = Math.round(board.width * board.height * level.fill) / 4;

    expect(board.width).toBe(10);
    expect(board.height).toBe(20);
    expect(board.tetrominoes).toHaveLength(expectedPieceCount);

    for (const piece of board.tetrominoes) {
      expect(piece.cells).toHaveLength(4);
      const shapeKey = normalizedShapeKey(piece.cells);
      expect(
        TETROMINO_ORIENTATIONS[piece.type].some((orientation) => normalizedShapeKey(orientation) === shapeKey),
        `${piece.id} is not a valid ${piece.type}: ${shapeKey}`,
      ).toBe(true);
      counts.set(piece.type, (counts.get(piece.type) ?? 0) + 1);
      for (const cell of piece.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(board.width);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeLessThan(board.height);
        const key = `${cell.x}:${cell.y}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }

    expect(occupied.size).toBe(expectedPieceCount * 4);
    expect([...counts.keys()].every((type) => level.tetrominoTypes.includes(type))).toBe(true);
    const enabledCounts = level.tetrominoTypes.map((type) => counts.get(type) ?? 0);
    expect(Math.max(...enabledCounts) - Math.min(...enabledCounts)).toBeLessThanOrEqual(1);
    expect(board.tetrominoes.some((piece) => getBlockingTetrominoIds(piece, board).length > 0)).toBe(true);
    expect(findRemovalSequence(board)).toHaveLength(expectedPieceCount);
  });
});
