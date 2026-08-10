import { describe, expect, it } from "vitest";
import { createPieceHitArea } from "../src/renderer/pieceHitArea";

describe("hit-area тетрамино", () => {
  it("повторяет клетки фигуры, а не её прямоугольные границы", () => {
    const area = createPieceHitArea([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ], 40);

    expect(area.contains(20, 20)).toBe(true);
    expect(area.contains(60, 60)).toBe(true);
    expect(area.contains(20, 60)).toBe(false);
    expect(area.contains(100, 60)).toBe(false);
  });

  it("может удерживать уже наведённую фигуру у видимой боковой грани", () => {
    let padding = 0;
    const area = createPieceHitArea([{ x: 0, y: 0 }], 40, () => padding);

    expect(area.contains(42, 20)).toBe(false);
    padding = 5;
    expect(area.contains(42, 20)).toBe(true);
  });
});
