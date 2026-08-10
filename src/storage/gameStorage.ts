import type { GameState } from "../types/game";

const SESSION_KEY = "anti-tetris:session";
const PROGRESS_KEY = "anti-tetris:progress";

export interface Progress {
  completedLevels: string[];
  bestTimes: Record<string, number>;
}

export function loadSession(levelId: string): GameState | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    const state = JSON.parse(raw) as GameState & { timerStarted?: boolean };
    if (state.levelId !== levelId || state.status === "completed" || state.status === "failed") return undefined;
    return {
      ...state,
      status: "playing",
      timerStarted: state.timerStarted ?? (state.elapsedTime > 0 || state.penalties > 0),
    };
  } catch {
    return undefined;
  }
}

export function saveSession(state: GameState): void {
  try {
    if (state.status === "completed" || state.status === "failed") sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export function saveCompletedLevel(levelId: string, elapsedTime: number): void {
  try {
    const progress = loadProgress();
    if (!progress.completedLevels.includes(levelId)) progress.completedLevels.push(levelId);
    progress.bestTimes[levelId] = Math.min(progress.bestTimes[levelId] ?? Number.POSITIVE_INFINITY, elapsedTime);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // The game remains fully playable without persistent storage.
  }
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Progress) : { completedLevels: [], bestTimes: {} };
  } catch {
    return { completedLevels: [], bestTimes: {} };
  }
}
