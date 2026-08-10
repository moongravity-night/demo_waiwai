import { aggregateSessions } from "../analytics/sessionMetrics";
import { downloadSessionFile, loadSessionFile, SESSION_FILE_NAME } from "../analytics/sessionFile";
import type { GameSessionRecord, SessionFile, SessionStatus } from "../analytics/sessionTypes";

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const rest = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function formatLevel(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function statusLabel(status: SessionStatus): string {
  if (status === "completed") return "Игра пройдена";
  if (status === "abandoned") return "Покинул игру";
  return "Активна";
}

function cell(text: string): HTMLTableCellElement {
  const item = document.createElement("td");
  item.textContent = text;
  return item;
}

function renderSessionRows(body: HTMLTableSectionElement, sessions: readonly GameSessionRecord[]): void {
  body.replaceChildren();
  for (const session of [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    const row = document.createElement("tr");
    row.append(
      cell(session.id.slice(0, 8)),
      cell(session.userId.slice(0, 8)),
      cell(formatDate(session.startedAt)),
      cell(formatDuration(session.durationSeconds)),
      cell(String(session.currentLevel)),
      cell(String(session.highestLevel)),
      cell(statusLabel(session.status)),
    );
    row.dataset.status = session.status;
    body.appendChild(row);
  }
}

function render(file: SessionFile): void {
  const metrics = aggregateSessions(file.sessions);
  const setText = (id: string, value: string): void => {
    const target = document.getElementById(id);
    if (target) target.textContent = value;
  };

  setText("metric-sessions", String(metrics.totalSessions));
  setText("metric-users", String(metrics.totalUsers));
  setText("metric-duration", formatDuration(metrics.averageSessionSeconds));
  setText("metric-abandon-level", formatLevel(metrics.averageAbandonmentLevel));
  setText("admin-updated", `Обновлено ${formatDate(file.updatedAt)}`);

  const usersBody = document.getElementById("users-body") as HTMLTableSectionElement;
  usersBody.replaceChildren();
  for (const user of metrics.users) {
    const row = document.createElement("tr");
    row.append(
      cell(user.userId.slice(0, 8)),
      cell(String(user.sessionCount)),
      cell(formatDuration(user.averageSessionSeconds)),
      cell(formatLevel(user.averageAbandonmentLevel)),
      cell(formatDate(user.lastSeenAt)),
    );
    usersBody.appendChild(row);
  }

  renderSessionRows(document.getElementById("sessions-body") as HTMLTableSectionElement, file.sessions);
}

export async function mountAdmin(): Promise<void> {
  document.title = "Антитетрис — метрики";
  document.body.classList.add("admin-page");
  const root = document.getElementById("app");
  if (!root) throw new Error("Не найден контейнер #app");
  root.innerHTML = `
    <main class="admin-shell">
      <header class="admin-header">
        <div>
          <p class="eyebrow">АНТИТЕТРИС</p>
          <h1>Метрики игровых сессий</h1>
          <p id="admin-updated" class="admin-muted">Загрузка данных…</p>
        </div>
        <nav class="admin-actions" aria-label="Действия админки">
          <a class="admin-button" href="/">Вернуться в игру</a>
          <button id="admin-refresh" class="admin-button" type="button">Обновить</button>
          <button id="admin-export" class="admin-button primary" type="button">Экспорт JSON</button>
        </nav>
      </header>

      <section class="metric-grid" aria-label="Общие показатели">
        <article class="metric-card"><span>Сессии</span><strong id="metric-sessions">0</strong></article>
        <article class="metric-card"><span>Пользователи</span><strong id="metric-users">0</strong></article>
        <article class="metric-card"><span>Среднее время сессии</span><strong id="metric-duration">0:00</strong></article>
        <article class="metric-card"><span>Средний уровень выхода</span><strong id="metric-abandon-level">—</strong></article>
      </section>

      <section class="admin-section">
        <div class="admin-section-heading">
          <div><p class="eyebrow">ПО ПОЛЬЗОВАТЕЛЯМ</p><h2>Агрегированная информация</h2></div>
          <p>Количество сессий и средний уровень, на котором пользователь покидает игру.</p>
        </div>
        <div class="table-scroll"><table>
          <thead><tr><th>Пользователь</th><th>Сессии</th><th>Среднее время</th><th>Средний уровень выхода</th><th>Последняя активность</th></tr></thead>
          <tbody id="users-body"></tbody>
        </table></div>
      </section>

      <section class="admin-section">
        <div class="admin-section-heading">
          <div><p class="eyebrow">ДЕТАЛИЗАЦИЯ</p><h2>Игровые сессии</h2></div>
          <p>Источник: <code>${SESSION_FILE_NAME}</code> в браузерном OPFS.</p>
        </div>
        <div class="table-scroll"><table>
          <thead><tr><th>Сессия</th><th>Пользователь</th><th>Начало</th><th>Время</th><th>Последний уровень</th><th>Макс. уровень</th><th>Статус</th></tr></thead>
          <tbody id="sessions-body"></tbody>
        </table></div>
      </section>
    </main>`;

  let file = await loadSessionFile();
  render(file);
  document.getElementById("admin-refresh")?.addEventListener("click", async () => {
    file = await loadSessionFile();
    render(file);
  });
  document.getElementById("admin-export")?.addEventListener("click", () => downloadSessionFile(file));
}
