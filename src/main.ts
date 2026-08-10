import "./styles.css";
import { mountAdmin } from "./admin/adminApp";
import { GameSessionTracker } from "./analytics/GameSessionTracker";
import { AudioManager } from "./audio/AudioManager";
import { getCompletedLevels, getFirstIncompleteLevel, getNextLevel, LEVELS } from "./config/levels";
import { EventBus } from "./events/EventBus";
import { GameStore } from "./game/GameStore";
import { PixiGame } from "./renderer/PixiGame";
import { loadProgress, loadSession, saveCompletedLevel, saveSession } from "./storage/gameStorage";
import type { GameState, LevelConfig } from "./types/game";
import { getLevelIntroContent } from "./ui/introContent";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Не найден элемент #${id}`);
  return found as T;
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

const INTRO_SEEN_KEY = "antitetetris:intro-seen:v1";
const RULES_SEEN_KEY = "antitetetris:rules-seen:v1";

function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberIntro(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Storage can be unavailable in private browsing; the game must still start.
  }
}

function hasSeenRules(): boolean {
  try {
    return localStorage.getItem(RULES_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberRules(): void {
  try {
    localStorage.setItem(RULES_SEEN_KEY, "1");
  } catch {
    // Storage can be unavailable in private browsing; the game must still start.
  }
}

if (window.location.pathname === "/admin" || window.location.pathname === "/admin/") {
  await mountAdmin();
} else {
  await mountGame();
}

async function mountGame(): Promise<void> {

const canvasHost = element<HTMLDivElement>("game-canvas");
const levelNumber = element<HTMLSpanElement>("level-number");
const timer = element<HTMLSpanElement>("timer");
const penalty = element<HTMLSpanElement>("penalty");
const sessionRules = element<HTMLElement>("session-rules");
const sessionRulesClose = element<HTMLButtonElement>("session-rules-close");
const pauseScreen = element<HTMLElement>("pause-screen");
const resultScreen = element<HTMLElement>("result-screen");
const resultKicker = element<HTMLSpanElement>("result-kicker");
const resultTitle = element<HTMLHeadingElement>("result-title");
const resultPraise = element<HTMLParagraphElement>("result-praise");
const resultTime = element<HTMLParagraphElement>("result-time");
const intro = element<HTMLDivElement>("intro");
const introLevel = element<HTMLSpanElement>("intro-level");
const introTitle = element<HTMLHeadingElement>("intro-title");
const introSubtitle = element<HTMLParagraphElement>("intro-subtitle");
const hint = element<HTMLDivElement>("hint");
const pauseButton = element<HTMLButtonElement>("pause-button");
const soundButton = element<HTMLButtonElement>("sound-button");
const continueButton = element<HTMLButtonElement>("continue-button");
const rulesButton = element<HTMLButtonElement>("rules-button");
const levelSelect = element<HTMLDivElement>("level-select");
const levelSelectButtons = element<HTMLDivElement>("level-select-buttons");
const restartButton = element<HTMLButtonElement>("restart-button");
const resultButton = element<HTMLButtonElement>("result-button");
let introHideTimer: number | undefined;
let introCanBeShown = !hasSeenIntro();
let resultShowTimer: number | undefined;
let resultAction: "retry" | "next" | "restart-campaign" = "retry";
let rulesReturnTarget: "game" | "pause" = "game";
const LEVEL_PRAISE = [
  "Отличное начало!",
  "Уверенно и точно!",
  "Прекрасно видите путь!",
  "Весь набор покорён!",
  "Полный стакан разобран!",
] as const;

const events = new EventBus();
const audio = new AudioManager();
let currentLevel = getFirstIncompleteLevel(loadProgress().completedLevels);
const sessionTracker = await GameSessionTracker.start(currentLevel.number);
const restoredState = loadSession(currentLevel.id);
let store = new GameStore(currentLevel, events, restoredState);
store.pause();
const renderer = new PixiGame(canvasHost, (id) => {
  hideIntro();
  store.selectTetromino(id);
});

await renderer.init(store.state.board);
document.documentElement.dataset.gameState = "ready";

function updateHud(state: GameState): void {
  const time = formatTime(state.remainingTime);
  if (timer.textContent !== time) timer.textContent = time;
  timer.classList.toggle("warning", state.remainingTime <= currentLevel.timeLimitSeconds * 0.2 && state.remainingTime > 10);
  timer.classList.toggle("critical", state.remainingTime <= 10);
  audio.syncCountdown(
    state.status === "playing" && state.timerStarted && state.remainingTime > 0 && state.remainingTime <= 5,
  );
  pauseButton.disabled = state.status === "completed" || state.status === "failed";
  pauseButton.style.opacity = pauseButton.disabled ? "0.28" : "1";
}

function updateLevelLabels(): void {
  const number = String(currentLevel.number).padStart(2, "0");
  levelNumber.textContent = number;
  introLevel.textContent = `УРОВЕНЬ ${number}`;
}

function showPenalty(seconds: number): void {
  penalty.textContent = `−${seconds}s`;
  penalty.classList.remove("visible");
  void penalty.offsetWidth;
  penalty.classList.add("visible");
}

function setPaused(paused: boolean): void {
  if (paused) store.pause();
  else store.resume();
  if (paused) updateCompletedLevelMenu();
  pauseScreen.hidden = !paused;
  renderer.setPaused(paused);
  pauseButton.setAttribute("aria-label", paused ? "Продолжить игру" : "Пауза");
}

function updateCompletedLevelMenu(): void {
  const completedLevels = getCompletedLevels(loadProgress().completedLevels);
  levelSelectButtons.replaceChildren();
  levelSelect.hidden = completedLevels.length === 0;

  for (const level of completedLevels) {
    const button = document.createElement("button");
    const number = String(level.number).padStart(2, "0");
    button.type = "button";
    button.className = "level-select-button";
    button.textContent = number;
    button.title = level.title;
    button.setAttribute("aria-label", `Играть в пройденный уровень ${number}: ${level.title}`);
    if (level.id === currentLevel.id) {
      button.disabled = true;
      button.setAttribute("aria-current", "true");
    }
    button.addEventListener("click", () => {
      audio.button();
      startLevel(level);
    });
    levelSelectButtons.append(button);
  }
}

function showSessionBriefing(returnTarget: "game" | "pause"): void {
  hideIntro();
  store.pause();
  renderer.setPaused(true);
  rulesReturnTarget = returnTarget;
  pauseScreen.hidden = true;
  sessionRules.hidden = false;
  sessionRulesClose.focus();
}

function closeSessionBriefing(): void {
  if (sessionRules.hidden) return;
  sessionRules.hidden = true;
  if (rulesReturnTarget === "pause") {
    pauseScreen.hidden = false;
    renderer.setPaused(true);
    rulesButton.focus();
    return;
  }
  renderer.setPaused(false);
  store.resume();
  showGameIntro();
}

function startInitialExperience(): void {
  if (!hasSeenRules()) {
    rememberRules();
    showSessionBriefing("game");
    return;
  }
  renderer.setPaused(false);
  store.resume();
  showGameIntro();
}

function restart(): void {
  window.clearTimeout(resultShowTimer);
  resultShowTimer = undefined;
  resultScreen.hidden = true;
  pauseScreen.hidden = true;
  store.restart();
  renderer.setBoard(store.state.board);
  renderer.setPaused(false);
  pauseButton.setAttribute("aria-label", "Пауза");
  showLevelIntro();
}

function startLevel(level: LevelConfig): void {
  window.clearTimeout(resultShowTimer);
  resultShowTimer = undefined;
  resultScreen.hidden = true;
  pauseScreen.hidden = true;
  currentLevel = level;
  sessionTracker.touch(currentLevel.number);
  store = new GameStore(currentLevel, events);
  renderer.setBoard(store.state.board);
  renderer.setPaused(false);
  pauseButton.setAttribute("aria-label", "Пауза");
  updateLevelLabels();
  updateHud(store.state);
  saveSession(store.state);
  showLevelIntro();
}

function showResult(state: GameState, completed: boolean): void {
  const nextLevel = completed ? getNextLevel(currentLevel.id) : undefined;
  resultScreen.classList.remove("failed", "level-complete", "campaign-complete");
  if (!completed) {
    resultKicker.textContent = "ВРЕМЯ ВЫШЛО";
    resultTitle.textContent = "—";
    resultPraise.textContent = "Стакан устоял. Попробуйте другой порядок.";
    resultTime.textContent = `${state.board.tetrominoes.length} фигур осталось`;
    resultScreen.classList.add("failed");
    resultAction = "retry";
    resultButton.textContent = "↻";
    resultButton.setAttribute("aria-label", "Повторить уровень");
  } else if (nextLevel) {
    resultKicker.textContent = "УРОВЕНЬ ПРОЙДЕН";
    resultTitle.textContent = String(currentLevel.number).padStart(2, "0");
    resultPraise.textContent = LEVEL_PRAISE[currentLevel.number - 1] ?? "Отличная работа!";
    resultTime.textContent = formatTime(state.elapsedTime);
    resultScreen.classList.add("level-complete");
    resultAction = "next";
    resultButton.textContent = "→";
    resultButton.setAttribute("aria-label", `Перейти на уровень ${String(nextLevel.number).padStart(2, "0")}`);
  } else {
    resultKicker.textContent = "БЛЕСТЯЩЕ";
    resultTitle.textContent = "✓";
    resultPraise.textContent = "Вы прошли весь Антитетрис!";
    resultTime.textContent = formatTime(state.elapsedTime);
    resultScreen.classList.add("campaign-complete");
    resultAction = "restart-campaign";
    resultButton.textContent = "↻";
    resultButton.setAttribute("aria-label", "Начать кампанию заново");
  }

  resultShowTimer = window.setTimeout(() => {
    resultScreen.hidden = false;
    resultButton.focus();
  }, completed ? 800 : 250);
}

function showGameIntro(): void {
  if (!introCanBeShown) {
    hideIntro();
    hint.classList.add("visible");
    return;
  }
  introCanBeShown = false;
  rememberIntro();
  showIntroCard("АНТИТЕТРИС", currentLevel.title, false);
}

function showLevelIntro(): void {
  const content = getLevelIntroContent(currentLevel);
  if (!content) {
    hideIntro();
    hint.classList.add("visible");
    return;
  }
  introLevel.textContent = content.eyebrow;
  showIntroCard(content.title, content.subtitle, true);
}

function showIntroCard(title: string, subtitle: string, levelCard: boolean): void {
  window.clearTimeout(introHideTimer);
  introTitle.textContent = title;
  introSubtitle.textContent = subtitle;
  intro.classList.toggle("level-card", levelCard);
  intro.hidden = false;
  intro.setAttribute("aria-hidden", "false");
  intro.classList.remove("visible");
  hint.classList.remove("visible");
  void intro.offsetWidth;
  intro.classList.add("visible");
  window.setTimeout(() => hint.classList.add("visible"), 1250);
  introHideTimer = window.setTimeout(hideIntro, 1500);
}

function hideIntro(): void {
  window.clearTimeout(introHideTimer);
  introHideTimer = undefined;
  intro.classList.remove("visible");
  intro.hidden = true;
  intro.setAttribute("aria-hidden", "true");
}

events.subscribe((event) => {
  switch (event.type) {
    case "state:changed":
      updateHud(event.state);
      saveSession(event.state);
      sessionTracker.touch(currentLevel.number);
      break;
    case "tetromino:removed":
      renderer.animateRemoval(event.tetromino);
      audio.removal();
      break;
    case "tetromino:blocked":
      renderer.animateBlocked(event.tetromino.id, event.blockers);
      showPenalty(event.penaltySeconds);
      audio.blocked();
      break;
    case "level:completed":
      if (getNextLevel(currentLevel.id)) {
        renderer.celebrate(false);
        audio.levelComplete();
      } else {
        renderer.celebrate(true);
        audio.campaignComplete();
        sessionTracker.complete(currentLevel.number);
      }
      saveCompletedLevel(event.state.levelId, event.state.elapsedTime);
      showResult(event.state, true);
      break;
    case "level:failed":
      renderer.fail();
      audio.failure();
      showResult(event.state, false);
      break;
  }
});

pauseButton.addEventListener("click", () => {
  audio.button();
  setPaused(store.state.status !== "paused");
});
continueButton.addEventListener("click", () => {
  audio.button();
  setPaused(false);
});
rulesButton.addEventListener("click", () => {
  audio.button();
  showSessionBriefing("pause");
});
restartButton.addEventListener("click", () => {
  audio.restart();
  restart();
});
sessionRulesClose.addEventListener("click", () => {
  audio.button();
  closeSessionBriefing();
});
sessionRules.addEventListener("click", (event) => {
  if (event.target === sessionRules) {
    audio.button();
    closeSessionBriefing();
  }
});
resultButton.addEventListener("click", () => {
  if (resultAction === "retry") {
    audio.restart();
    restart();
  } else {
    audio.button();
    if (resultAction === "next") startLevel(getNextLevel(currentLevel.id) ?? LEVELS[0]!);
    else startLevel(LEVELS[0]!);
  }
});
soundButton.addEventListener("click", () => {
  const enabled = audio.toggle();
  if (enabled) {
    audio.button();
    audio.syncCountdown(
      store.state.status === "playing" &&
        store.state.timerStarted &&
        store.state.remainingTime > 0 &&
        store.state.remainingTime <= 5,
    );
  }
  soundButton.classList.toggle("sound-off", !enabled);
  soundButton.setAttribute("aria-label", enabled ? "Выключить звук" : "Включить звук");
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!sessionRules.hidden) {
    closeSessionBriefing();
    return;
  }
  if (resultScreen.hidden === false) return;
  setPaused(store.state.status !== "paused");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && store.state.status === "playing") setPaused(true);
});

renderer.onTick((ticker) => store.tick(ticker.deltaMS / 1000));
updateLevelLabels();
updateHud(store.state);
startInitialExperience();

window.addEventListener("beforeunload", () => {
  sessionTracker.abandon();
  saveSession(store.state);
  audio.destroy();
  renderer.destroy();
});

window.addEventListener("pagehide", () => sessionTracker.abandon());
}
