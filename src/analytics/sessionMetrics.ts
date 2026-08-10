import type { GameSessionRecord } from "./sessionTypes";

export interface UserSessionMetrics {
  userId: string;
  sessionCount: number;
  averageSessionSeconds: number;
  averageAbandonmentLevel: number | null;
  lastSeenAt: string;
}

export interface SessionMetrics {
  totalSessions: number;
  totalUsers: number;
  averageSessionSeconds: number;
  averageAbandonmentLevel: number | null;
  users: UserSessionMetrics[];
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function aggregateSessions(sessions: readonly GameSessionRecord[]): SessionMetrics {
  const byUser = new Map<string, GameSessionRecord[]>();
  for (const session of sessions) {
    const userSessions = byUser.get(session.userId) ?? [];
    userSessions.push(session);
    byUser.set(session.userId, userSessions);
  }

  const users = [...byUser.entries()].map(([userId, userSessions]) => {
    const abandonedLevels = userSessions
      .filter((session) => session.status === "abandoned")
      .map((session) => session.currentLevel);
    return {
      userId,
      sessionCount: userSessions.length,
      averageSessionSeconds: average(userSessions.map((session) => session.durationSeconds)),
      averageAbandonmentLevel: abandonedLevels.length > 0 ? average(abandonedLevels) : null,
      lastSeenAt: userSessions.reduce(
        (latest, session) => session.lastSeenAt > latest ? session.lastSeenAt : latest,
        userSessions[0]!.lastSeenAt,
      ),
    };
  }).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  const abandonedLevels = sessions
    .filter((session) => session.status === "abandoned")
    .map((session) => session.currentLevel);

  return {
    totalSessions: sessions.length,
    totalUsers: users.length,
    averageSessionSeconds: average(sessions.map((session) => session.durationSeconds)),
    averageAbandonmentLevel: abandonedLevels.length > 0 ? average(abandonedLevels) : null,
    users,
  };
}
