import { buildOccupancy, cellKey, findRemovalSequence, getBlockingTetrominoIds } from "./board";
import { createRandom, shuffle, type Random } from "./random";
import { shapeSize, TETROMINO_ORIENTATIONS } from "./tetrominoes";
import type { BoardState, Cell, LevelConfig, Tetromino, TetrominoType } from "../types/game";

export interface GenerationResult {
  board: BoardState;
  solution: string[];
  seed: number;
}

interface FullBoardBlock {
  rows: readonly string[];
  types: readonly TetrominoType[];
}

// Ten independently removable 5×4 tilings. Together they form a complete
// 10×20 board with an even 7/8-piece distribution across all seven types.
const FULL_BOARD_BLOCKS: readonly FullBoardBlock[] = [
  { rows: ["00001", "22221", "33331", "44441"], types: ["I", "I", "I", "I", "I"] },
  { rows: ["00001", "22331", "24431", "24431"], types: ["I", "I", "J", "L", "O"] },
  { rows: ["00112", "01122", "03342", "33444"], types: ["J", "S", "T", "S", "T"] },
  { rows: ["00112", "01122", "03342", "33444"], types: ["J", "S", "T", "S", "T"] },
  { rows: ["00112", "01122", "03342", "33444"], types: ["J", "S", "T", "S", "T"] },
  { rows: ["00122", "01122", "01344", "33344"], types: ["J", "Z", "O", "L", "O"] },
  { rows: ["00122", "01122", "01344", "33344"], types: ["J", "Z", "O", "L", "O"] },
  { rows: ["00011", "02211", "33224", "33444"], types: ["L", "O", "Z", "O", "L"] },
  { rows: ["01122", "00112", "30442", "33344"], types: ["S", "Z", "L", "J", "Z"] },
  { rows: ["01122", "00112", "03442", "33344"], types: ["T", "Z", "L", "T", "Z"] },
];

const MIRRORED_TYPE: Readonly<Record<TetrominoType, TetrominoType>> = {
  I: "I",
  J: "L",
  L: "J",
  O: "O",
  S: "Z",
  T: "T",
  Z: "S",
};

function createFullBoard(config: LevelConfig, seed: number): BoardState | null {
  if (config.board.width !== 10 || config.board.height !== 20) return null;
  if (FULL_BOARD_BLOCKS.some((block) => block.types.some((type) => !config.tetrominoTypes.includes(type)))) return null;

  const random = createRandom(seed);
  const blocks = shuffle([...FULL_BOARD_BLOCKS], random);
  const tetrominoes: Tetromino[] = [];
  const mirrored = random() < 0.5;

  blocks.forEach((block, blockIndex) => {
    const offsetX = (blockIndex % 2) * 5;
    const offsetY = Math.floor(blockIndex / 2) * 4;

    block.types.forEach((sourceType, pieceIndex) => {
      const cells: Cell[] = [];
      block.rows.forEach((row, y) => {
        [...row].forEach((label, x) => {
          if (Number(label) !== pieceIndex) return;
          cells.push({ x: offsetX + (mirrored ? 4 - x : x), y: offsetY + y });
        });
      });

      const placementOrder = tetrominoes.length;
      tetrominoes.push({
        id: `piece-${placementOrder + 1}`,
        type: mirrored ? MIRRORED_TYPE[sourceType] : sourceType,
        cells,
        placementOrder,
      });
    });
  });

  return { width: config.board.width, height: config.board.height, tetrominoes };
}

function createTypeBag(config: LevelConfig, count: number, random: Random): TetrominoType[] {
  const enabled = config.tetrominoTypes.filter((type) => config.tetrominoWeights[type] > 0);
  const bag: TetrominoType[] = [];
  const totalWeight = enabled.reduce((sum, type) => sum + config.tetrominoWeights[type], 0);
  const exact = enabled.map((type) => ({
    type,
    amount: (config.tetrominoWeights[type] / totalWeight) * count,
  }));

  for (const entry of exact) {
    const baseCount = Math.floor(entry.amount);
    for (let index = 0; index < baseCount; index += 1) bag.push(entry.type);
  }

  const remainderOrder = [...exact].sort((a, b) => {
    const fractionDifference = (b.amount % 1) - (a.amount % 1);
    return fractionDifference || random() - 0.5;
  });

  let cursor = 0;
  while (bag.length < count) {
    bag.push(remainderOrder[cursor % remainderOrder.length]!.type);
    cursor += 1;
  }

  return shuffle(bag, random);
}

function canPlace(cells: readonly Cell[], x: number, y: number, board: BoardState): boolean {
  const occupied = buildOccupancy(board);
  return cells.every((cell) => {
    const worldX = cell.x + x;
    const worldY = cell.y + y;
    return (
      worldX >= 0 &&
      worldX < board.width &&
      worldY >= 0 &&
      worldY < board.height &&
      !occupied.has(cellKey(worldX, worldY))
    );
  });
}

function dropPlacement(
  type: TetrominoType,
  id: string,
  placementOrder: number,
  board: BoardState,
  random: Random,
): Tetromino | null {
  const orientations = TETROMINO_ORIENTATIONS[type];
  const candidates: Array<{ cells: readonly Cell[]; x: number; jitter: number }> = [];

  for (const cells of orientations) {
    const { width } = shapeSize(cells);
    for (let x = 0; x <= board.width - width; x += 1) {
      candidates.push({ cells, x, jitter: random() });
    }
  }

  shuffle(candidates, random);
  const placements: Array<{ piece: Tetromino; top: number; roughness: number; jitter: number }> = [];

  for (const candidate of candidates) {
    if (!canPlace(candidate.cells, candidate.x, 0, board)) continue;
    let y = 0;
    while (canPlace(candidate.cells, candidate.x, y + 1, board)) y += 1;

    const cells = candidate.cells.map((cell) => ({ x: cell.x + candidate.x, y: cell.y + y }));
    const simulated: BoardState = {
      ...board,
      tetrominoes: [...board.tetrominoes, { id, type, cells, placementOrder }],
    };
    const columnTops = Array.from({ length: board.width }, (_, x) => {
      const ys = simulated.tetrominoes.flatMap((piece) => piece.cells.filter((cell) => cell.x === x).map((cell) => cell.y));
      return ys.length ? Math.min(...ys) : board.height;
    });
    const occupiedTops = columnTops.filter((top) => top < board.height);
    const roughness = occupiedTops.length ? Math.max(...occupiedTops) - Math.min(...occupiedTops) : 0;
    placements.push({
      piece: { id, type, cells, placementOrder },
      top: Math.min(...cells.map((cell) => cell.y)),
      roughness,
      jitter: candidate.jitter,
    });
  }

  placements.sort((a, b) => b.top - a.top || a.roughness - b.roughness || a.jitter - b.jitter);
  const shortlist = placements.slice(0, Math.min(6, placements.length));
  return shortlist[Math.floor(random() * shortlist.length)]?.piece ?? null;
}

function tryGenerate(config: LevelConfig, seed: number): BoardState | null {
  const random = createRandom(seed);
  const targetCells = Math.round(config.board.width * config.board.height * config.fill);
  if (targetCells % 4 !== 0) throw new Error("Заполнение уровня должно давать число клеток, кратное четырём");

  if (targetCells === config.board.width * config.board.height) return createFullBoard(config, seed);

  const pieceCount = targetCells / 4;
  const bag = createTypeBag(config, pieceCount, random);
  const board: BoardState = {
    width: config.board.width,
    height: config.board.height,
    tetrominoes: [],
  };

  for (let index = 0; index < bag.length; index += 1) {
    const type = bag[index]!;
    const piece = dropPlacement(type, `piece-${index + 1}`, index, board, random);
    if (!piece) return null;
    board.tetrominoes.push(piece);
  }

  return board;
}

export function generateLevel(config: LevelConfig, seed = crypto.getRandomValues(new Uint32Array(1))[0]!): GenerationResult {
  for (let attempt = 0; attempt < config.maxGenerationAttempts; attempt += 1) {
    const attemptSeed = (seed + attempt * 2654435761) >>> 0;
    const board = tryGenerate(config, attemptSeed);
    if (!board) continue;

    const solution = findRemovalSequence(board);
    const hasBlockedPiece = board.tetrominoes.some((piece) => getBlockingTetrominoIds(piece, board).length > 0);
    if (solution && hasBlockedPiece) return { board, solution, seed: attemptSeed };
  }

  throw new Error(`Не удалось сгенерировать корректный уровень ${config.id}`);
}
