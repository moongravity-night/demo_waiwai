import { loadSessionFile, saveSessionFile } from "./sessionFile";
import type { GameSessionRecord, SessionFile } from "./sessionTypes";

const USER_KEY = "anti-tetris:user-id";

function getUserId(): string {
  try {
    const existing = localStorage.getItem(USER_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(USER_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export class GameSessionTracker {
  private constructor(
    private readonly file: SessionFile,
    private readonly session: GameSessionRecord,
  ) {}

  static async start(levelNumber: number): Promise<GameSessionTracker> {
    const file = await loadSessionFile();
    const userId = getUserId();
    const now = new Date().toISOString();

    for (const session of file.sessions) {
      if (session.userId === userId && session.status === "active") {
        session.status = "abandoned";
        session.endedAt = session.lastSeenAt;
        session.updatedAt = now;
      }
    }

    const session: GameSessionRecord = {
      id: crypto.randomUUID(),
      userId,
      startedAt: now,
      lastSeenAt: now,
      durationSeconds: 0,
      currentLevel: levelNumber,
      highestLevel: levelNumber,
      status: "active",
      updatedAt: now,
    };
    file.sessions.push(session);
    file.updatedAt = now;
    saveSessionFile(file);
    return new GameSessionTracker(file, session);
  }

  touch(levelNumber: number): void {
    if (this.session.status !== "active") return;
    const now = new Date().toISOString();
    this.session.lastSeenAt = now;
    this.session.durationSeconds = Math.max(0, (Date.parse(now) - Date.parse(this.session.startedAt)) / 1000);
    this.session.currentLevel = levelNumber;
    this.session.highestLevel = Math.max(this.session.highestLevel, levelNumber);
    this.session.updatedAt = now;
    this.file.updatedAt = now;
    saveSessionFile(this.file);
  }

  complete(levelNumber: number): void {
    this.touch(levelNumber);
    if (this.session.status !== "active") return;
    const now = new Date().toISOString();
    this.session.status = "completed";
    this.session.endedAt = now;
    this.session.lastSeenAt = now;
    this.session.updatedAt = now;
    this.file.updatedAt = now;
    saveSessionFile(this.file);
  }

  abandon(): void {
    this.touch(this.session.currentLevel);
    if (this.session.status !== "active") return;
    const now = new Date().toISOString();
    this.session.status = "abandoned";
    this.session.endedAt = now;
    this.session.lastSeenAt = now;
    this.session.updatedAt = now;
    this.file.updatedAt = now;
    saveSessionFile(this.file);
  }
}
