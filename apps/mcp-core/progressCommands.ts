 

import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";

const API_BASE = process.env.BRUNELLA_API_URL || "http://localhost:3000";

type TrackTodoItem = {
  id: string;
  text: string;
  completed: boolean;
};

type TrackTodoSummary = {
  trackId: string;
  title: string;
  status?: string;
  progress: number;
  completedCount: number;
  totalCount: number;
};

type TrackTodosResponse = {
  success: boolean;
  trackId: string;
  title: string;
  todos: TrackTodoItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  updatedAt: string;
  error?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function writeLine(message = ""): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ""): void {
  process.stderr.write(`${message}\n`);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api/v1/tracks${path}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const err =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : `HTTP ${response.status}`;
    throw new Error(String(err));
  }

  return data;
}

function renderBar(pct: number, width = 24): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round((p / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${p}%`;
}

async function chooseTrack(): Promise<TrackTodoSummary | null> {
  const list = await apiFetch<{
    success: boolean;
    count: number;
    tracks: TrackTodoSummary[];
  }>("/todos/active");

  const tracks = (list.tracks || []).sort((a, b) => b.progress - a.progress);
  if (tracks.length === 0) {
    writeLine(
      chalk.yellow(
        "Nincs aktív track (vagy nincs meta.json status=active/in_progress).",
      ),
    );
    return null;
  }

  const { trackId } = await inquirer.prompt([
    {
      type: "list",
      name: "trackId",
      message: "Válassz tracket:",
      choices: tracks.map((t) => ({
        name: `${t.title}  (${t.completedCount}/${t.totalCount})  ${t.progress}%`,
        value: t.trackId,
      })),
    },
  ]);

  return tracks.find((t) => t.trackId === trackId) || null;
}

async function showTrackProgress() {
  const spinner = ora("Trackek betöltése...").start();
  try {
    const chosen = await chooseTrack();
    spinner.stop();
    if (!chosen) return;

    const data = await apiFetch<TrackTodosResponse>(
      `/${encodeURIComponent(chosen.trackId)}/todos`,
    );

    writeLine(chalk.bold(`\n📌 ${data.title}`));
    writeLine(
      chalk.dim(
        `ID: ${data.trackId} | ${data.completedCount}/${data.totalCount} | updated: ${data.updatedAt}`,
      ),
    );
    writeLine(chalk.green(renderBar(data.progress)));

    if (!data.todos.length) {
      writeLine(chalk.yellow("\nNincs checkbox TODO a track.md-ben."));
      return;
    }

    writeLine("");
    for (const t of data.todos) {
      writeLine(
        `${t.completed ? chalk.green("[x]") : chalk.gray("[ ]")} ${t.text} ${chalk.dim(`(${t.id})`)}`,
      );
    }

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Mit szeretnél?",
        choices: [
          { name: "✅ TODO kipipálása / visszavétele", value: "toggle" },
          { name: "🔄 Frissítés", value: "refresh" },
          { name: "🔙 Vissza", value: "back" },
        ],
      },
    ]);

    if (action === "back") return;

    if (action === "refresh") {
      await showTrackProgress();
      return;
    }

    if (action === "toggle") {
      const { todoId } = await inquirer.prompt([
        {
          type: "list",
          name: "todoId",
          message: "Melyik TODO-t?",
          choices: data.todos.map((t) => ({
            name: `${t.completed ? "[x]" : "[ ]"} ${t.text}`,
            value: t.id,
          })),
        },
      ]);

      const item = data.todos.find((t) => t.id === todoId);
      const next = item ? !item.completed : true;

      const saving = ora("Mentés...").start();
      await apiFetch<TrackTodosResponse>(
        `/${encodeURIComponent(data.trackId)}/todos/${encodeURIComponent(todoId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ completed: next }),
        },
      );
      saving.succeed("Mentve");

      await showTrackProgress();
    }
  } catch (e: unknown) {
    spinner.fail("Hiba");
    writeError(chalk.red(e instanceof Error ? e.message : String(e)));
  }
}

async function listAllProgress() {
  const spinner = ora("Track progress betöltése...").start();
  try {
    const data = await apiFetch<{
      success: boolean;
      count: number;
      tracks: TrackTodoSummary[];
    }>("/todos/active");
    spinner.stop();

    const tracks = (data.tracks || []).sort((a, b) => b.progress - a.progress);
    if (!tracks.length) {
      writeLine(chalk.yellow("Nincs aktív track."));
      return;
    }

    writeLine(chalk.bold("\n📈 Aktív track progress"));
    for (const t of tracks) {
      writeLine(
        `${chalk.cyan(t.trackId)}\n  ${t.title}\n  ${renderBar(t.progress)}  ${chalk.dim(`${t.completedCount}/${t.totalCount}`)}\n`,
      );
    }
  } catch (e: unknown) {
    spinner.fail("Hiba");
    writeError(chalk.red(e instanceof Error ? e.message : String(e)));
  }
}

export function registerProgressCommands(program: Command) {
  program
    .command("progress")
    .description("Track TODO / progress (magyar)")
    .action(async () => {
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "Progress menü:",
          choices: [
            { name: "📊 Track progress (választott track)", value: "one" },
            { name: "📈 Összes aktív track progress", value: "all" },
            { name: "❌ Mégsem", value: "cancel" },
          ],
        },
      ]);

      if (action === "cancel") return;
      if (action === "one") await showTrackProgress();
      if (action === "all") await listAllProgress();
    });
}
