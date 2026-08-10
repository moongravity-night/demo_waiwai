import { describe, expect, it } from "vitest";
import { aggregateSessions } from "../src/analytics/sessionMetrics";
import type { GameSessionRecord } from "../src/analytics/sessionTypes";

function session(overrides: Partial<GameSessionRecord> & Pick<GameSessionRecord, "id" | "userId">): GameSessionRecord {
  return {
    startedAt: "2026-08-10T10:00:00.000Z",
    lastSeenAt: "2026-08-10T10:01:00.000Z",
    durationSeconds: 60,
    currentLevel: 1,
    highestLevel: 1,
    status: "abandoned",
    updatedAt: "2026-08-10T10:01:00.000Z",
    ...overrides,
  };
}

describe("метрики игровых сессий", () => {
  it("агрегирует длительность, число сессий и уровень выхода по пользователям", () => {
    const metrics = aggregateSessions([
      session({ id: "s1", userId: "u1", durationSeconds: 60, currentLevel: 2 }),
      session({ id: "s2", userId: "u1", durationSeconds: 180, currentLevel: 4 }),
      session({ id: "s3", userId: "u2", durationSeconds: 90, currentLevel: 6, status: "completed" }),
    ]);

    expect(metrics.totalSessions).toBe(3);
    expect(metrics.totalUsers).toBe(2);
    expect(metrics.averageSessionSeconds).toBe(110);
    expect(metrics.averageAbandonmentLevel).toBe(3);
    expect(metrics.users.find((user) => user.userId === "u1")).toMatchObject({
      sessionCount: 2,
      averageSessionSeconds: 120,
      averageAbandonmentLevel: 3,
    });
    expect(metrics.users.find((user) => user.userId === "u2")?.averageAbandonmentLevel).toBeNull();
  });

  it("возвращает пустые показатели без сессий", () => {
    expect(aggregateSessions([])).toMatchObject({
      totalSessions: 0,
      totalUsers: 0,
      averageSessionSeconds: 0,
      averageAbandonmentLevel: null,
      users: [],
    });
  });
});
