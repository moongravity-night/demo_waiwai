export type SessionStatus = "active" | "abandoned" | "completed";

export interface GameSessionRecord {
  id: string;
  userId: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt?: string;
  durationSeconds: number;
  currentLevel: number;
  highestLevel: number;
  status: SessionStatus;
  updatedAt: string;
}

export interface SessionFile {
  version: 1;
  updatedAt: string;
  sessions: GameSessionRecord[];
}
