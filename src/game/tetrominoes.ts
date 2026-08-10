import type { Cell, TetrominoType } from "../types/game";

const BASE_SHAPES: Record<TetrominoType, Cell[]> = {
  I: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ],
  J: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  L: [
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  O: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  S: [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  T: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
  ],
  Z: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
};

function normalize(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function rotate(cells: Cell[]): Cell[] {
  return normalize(cells.map((cell) => ({ x: -cell.y, y: cell.x })));
}

function shapeKey(cells: Cell[]): string {
  return cells.map((cell) => `${cell.x},${cell.y}`).join(";");
}

export const TETROMINO_ORIENTATIONS: Record<TetrominoType, readonly Cell[][]> = Object.fromEntries(
  Object.entries(BASE_SHAPES).map(([type, base]) => {
    const orientations: Cell[][] = [];
    const seen = new Set<string>();
    let current = normalize(base);

    for (let turn = 0; turn < 4; turn += 1) {
      const key = shapeKey(current);
      if (!seen.has(key)) {
        seen.add(key);
        orientations.push(current);
      }
      current = rotate(current);
    }

    return [type, orientations];
  }),
) as unknown as Record<TetrominoType, readonly Cell[][]>;

export function shapeSize(cells: readonly Cell[]): { width: number; height: number } {
  return {
    width: Math.max(...cells.map((cell) => cell.x)) + 1,
    height: Math.max(...cells.map((cell) => cell.y)) + 1,
  };
}
