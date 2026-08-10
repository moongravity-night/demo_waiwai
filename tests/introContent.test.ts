import { describe, expect, it } from "vitest";
import { LEVEL_01 } from "../src/config/levels/level-01";
import { LEVEL_02 } from "../src/config/levels/level-02";
import { LEVEL_05 } from "../src/config/levels/level-05";
import { getLevelIntroContent } from "../src/ui/introContent";

describe("карточки названий уровней", () => {
  it("не создаёт переходную карточку для первого уровня", () => {
    expect(getLevelIntroContent(LEVEL_01)).toBeUndefined();
  });

  it("создаёт карточки с номером и названием для уровней 2 и выше", () => {
    expect(getLevelIntroContent(LEVEL_02)).toEqual({
      eyebrow: "УРОВЕНЬ 02",
      title: LEVEL_02.title,
      subtitle: "АНТИТЕТРИС",
    });
    expect(getLevelIntroContent(LEVEL_05)?.title).toBe(LEVEL_05.title);
  });
});
