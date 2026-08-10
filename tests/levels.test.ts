import { describe, expect, it } from "vitest";
import { getCompletedLevels, getFirstIncompleteLevel, getLevelById, getNextLevel, LEVELS } from "../src/config/levels";

describe("прогрессия уровней", () => {
  it("соответствует кривой сложности из user_level_design.md", () => {
    expect(LEVELS.map((level) => ({
      number: level.number,
      fill: level.fill,
      types: level.tetrominoTypes,
      time: level.timeLimitSeconds,
    }))).toEqual([
      { number: 1, fill: 0.24, types: ["O", "I"], time: 20 },
      { number: 2, fill: 0.5, types: ["O", "I"], time: 20 },
      { number: 3, fill: 0.5, types: ["O", "I", "L", "J"], time: 20 },
      { number: 4, fill: 0.5, types: ["I", "J", "L", "O", "S", "T", "Z"], time: 20 },
      { number: 5, fill: 1, types: ["I", "J", "L", "O", "S", "T", "Z"], time: 30 },
      { number: 6, fill: 1, types: ["I", "J", "L", "O", "S", "T", "Z"], time: 20 },
    ]);
  });

  it("открывает уровни строго последовательно", () => {
    expect(getFirstIncompleteLevel([]).id).toBe("level-01");
    expect(getFirstIncompleteLevel(["level-01", "level-02"]).id).toBe("level-03");
    expect(getNextLevel("level-03")?.id).toBe("level-04");
    expect(getNextLevel("level-06")).toBeUndefined();
    expect(getLevelById("level-04")?.number).toBe(4);
  });

  it("возвращает для меню только пройденные уровни в порядке прогрессии", () => {
    expect(getCompletedLevels(["level-03", "level-01", "unknown"]).map((level) => level.id)).toEqual([
      "level-01",
      "level-03",
    ]);
  });
});
