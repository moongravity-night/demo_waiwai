import type { Cell } from "../types/game";

export interface PieceHitArea {
  contains(x: number, y: number): boolean;
}

export function createPieceHitArea(
  cells: readonly Cell[],
  cellSize: number,
  getPadding: () => number = () => 0,
): PieceHitArea {
  return {
    contains: (x: number, y: number) => {
      const padding = getPadding();
      return cells.some((cell) => (
        x >= cell.x * cellSize - padding &&
        x < (cell.x + 1) * cellSize + padding &&
        y >= cell.y * cellSize - padding &&
        y < (cell.y + 1) * cellSize + padding
      ));
    },
  };
}
