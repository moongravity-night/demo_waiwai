import type { BoardState, Tetromino } from "../types/game";

export function cellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export function buildOccupancy(board: BoardState, ignoredId?: string): Map<string, string> {
  const occupancy = new Map<string, string>();
  for (const tetromino of board.tetrominoes) {
    if (tetromino.id === ignoredId) continue;
    for (const cell of tetromino.cells) occupancy.set(cellKey(cell.x, cell.y), tetromino.id);
  }
  return occupancy;
}

export function getBlockingTetrominoIds(tetromino: Tetromino, board: BoardState): string[] {
  const occupancy = buildOccupancy(board, tetromino.id);
  const blockers = new Set<string>();

  for (const cell of tetromino.cells) {
    for (let y = cell.y - 1; y >= 0; y -= 1) {
      const blocker = occupancy.get(cellKey(cell.x, y));
      if (blocker) blockers.add(blocker);
    }
  }

  return [...blockers];
}

export function canRemoveTetromino(tetromino: Tetromino, board: BoardState): boolean {
  return getBlockingTetrominoIds(tetromino, board).length === 0;
}

export function findRemovalSequence(board: BoardState): string[] | null {
  const working: BoardState = {
    ...board,
    tetrominoes: [...board.tetrominoes],
  };
  const sequence: string[] = [];

  while (working.tetrominoes.length > 0) {
    const removable = working.tetrominoes.find((piece) => canRemoveTetromino(piece, working));
    if (!removable) return null;
    sequence.push(removable.id);
    working.tetrominoes = working.tetrominoes.filter((piece) => piece.id !== removable.id);
  }

  return sequence;
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    ...board,
    tetrominoes: board.tetrominoes.map((piece) => ({
      ...piece,
      cells: piece.cells.map((cell) => ({ ...cell })),
    })),
  };
}
