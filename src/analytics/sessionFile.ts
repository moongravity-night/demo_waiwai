import type { GameSessionRecord, SessionFile } from "./sessionTypes";

export const SESSION_FILE_NAME = "anti-tetris-sessions.json";
const MIRROR_KEY = "anti-tetris:sessions-file";
const OPFS_READ_TIMEOUT_MS = 500;
let writeQueue = Promise.resolve();

function emptySessionFile(): SessionFile {
  return { version: 1, updatedAt: new Date(0).toISOString(), sessions: [] };
}

function parseSessionFile(raw: string | null): SessionFile | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<SessionFile>;
    if (value.version !== 1 || !Array.isArray(value.sessions) || typeof value.updatedAt !== "string") return undefined;
    return value as SessionFile;
  } catch {
    return undefined;
  }
}

function mergeSessionFiles(...files: Array<SessionFile | undefined>): SessionFile {
  const sessions = new Map<string, GameSessionRecord>();
  let updatedAt = new Date(0).toISOString();
  for (const file of files) {
    if (!file) continue;
    if (file.updatedAt > updatedAt) updatedAt = file.updatedAt;
    for (const session of file.sessions) {
      const existing = sessions.get(session.id);
      if (!existing || session.updatedAt > existing.updatedAt) sessions.set(session.id, session);
    }
  }
  return { version: 1, updatedAt, sessions: [...sessions.values()] };
}

function readMirror(): SessionFile | undefined {
  try {
    return parseSessionFile(localStorage.getItem(MIRROR_KEY));
  } catch {
    return undefined;
  }
}

function writeMirror(file: SessionFile): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(file));
  } catch {
    // OPFS remains the primary store when localStorage is unavailable.
  }
}

async function readOpfs(): Promise<SessionFile | undefined> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(SESSION_FILE_NAME);
    return parseSessionFile(await (await handle.getFile()).text());
  } catch {
    return undefined;
  }
}

async function writeOpfs(file: SessionFile): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(SESSION_FILE_NAME, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(file, null, 2));
    await writable.close();
  } catch {
    // The synchronous localStorage mirror is the fallback for unsupported browsers.
  }
}

export async function loadSessionFile(): Promise<SessionFile> {
  const opfsFile = await Promise.race([
    readOpfs(),
    new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), OPFS_READ_TIMEOUT_MS)),
  ]);
  const merged = mergeSessionFiles(emptySessionFile(), readMirror(), opfsFile);
  writeMirror(merged);
  void writeOpfs(merged);
  return merged;
}

export function saveSessionFile(file: SessionFile): void {
  const snapshot = structuredClone(file);
  writeMirror(snapshot);
  writeQueue = writeQueue.then(() => writeOpfs(snapshot));
}

export function downloadSessionFile(file: SessionFile): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = SESSION_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}
