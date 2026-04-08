/**
 * Tracks Management API Routes
 *
 * EPP v2 Protocol: Track generation and management endpoints
 * RULE-UI3: CLI és Dashboard ugyanazon API-t használja
 * RULE-UI4: Routes külön *Routes.ts fájlokban (clean separation)
 *
 * Endpoints:
 *   POST /api/tracks/generate - Generate track from idea (3-stage LLM pipeline)
 *   GET /api/tracks - List all tracks with metadata
 *   GET /api/tracks/:trackId - Get specific track details
 */

import { Router } from "express";
import { agentManager } from "../agents/AgentManager.js";
import { logInfo, logError, logDebug } from "../utils/logger.js";
import { ensureError } from "../utils/ensureError.js";
import { inferTrackGroup, TRACK_GROUP_ORDER, type TrackGroupId } from "../utils/trackGroups.js";
import { socketService } from "./SocketService.js";
import chokidar, { type FSWatcher } from "chokidar";
import fs from "fs/promises";
import path from "path";

type TrackTodoItem = {
  id: string;
  text: string;
  completed: boolean;
};

type TrackTodosResponse = {
  trackId: string;
  title: string;
  todos: TrackTodoItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  updatedAt: string;
};

function getTracksDir(override?: string): string {
  const env = process.env.BRUNELLA_CONDUCTOR_TRACKS_DIR;
  const base =
    override ||
    (typeof env === "string" && env.trim() ? env.trim() : undefined);
  return base
    ? path.resolve(process.cwd(), base)
    : path.join(process.cwd(), "conductor", "tracks");
}

function isSafeTrackId(trackId: string): boolean {
  // Prevent path traversal, allow common IDs like: foo-bar_20260211
  return /^[a-z0-9][a-z0-9_-]*$/i.test(trackId);
}

function parseTrackTitle(markdown: string, fallback: string): string {
  const first = markdown.split("\n").find((l) => l.startsWith("# "));
  return first ? first.replace(/^#\s+/, "").trim() : fallback;
}

function parseTodosFromMarkdown(markdown: string): TrackTodoItem[] {
  const lines = markdown.split("\n");
  const items: TrackTodoItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^\s*[-*]\s+\[( |x|X)\]\s+(.*\S)\s*$/.exec(line);
    if (!m) continue;
    items.push({
      id: `line:${i}`,
      completed: m[1].toLowerCase() === "x",
      text: m[2].trim(),
    });
  }
  return items;
}

function toggleTodoLine(
  markdown: string,
  lineIndex: number,
  desired?: boolean,
): string {
  const lines = markdown.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error(`Todo line out of range: ${lineIndex}`);
  }
  const line = lines[lineIndex];
  const m = /^(\s*[-*]\s+)\[( |x|X)\](\s+.*)$/.exec(line);
  if (!m) {
    throw new Error(`Line is not a checkbox todo: ${lineIndex}`);
  }
  const current = m[2].toLowerCase() === "x";
  const next = typeof desired === "boolean" ? desired : !current;
  lines[lineIndex] = `${m[1]}[${next ? "x" : " "}]${m[3]}`;
  return lines.join("\n");
}

async function readTrackMarkdown(
  tracksDir: string,
  trackId: string,
): Promise<string> {
  const trackPath = path.join(tracksDir, trackId, "track.md");
  return await fs.readFile(trackPath, "utf-8");
}

async function writeTrackMarkdown(
  tracksDir: string,
  trackId: string,
  markdown: string,
): Promise<void> {
  const trackPath = path.join(tracksDir, trackId, "track.md");
  await fs.writeFile(trackPath, markdown, "utf-8");
}

async function buildTodosResponse(
  tracksDir: string,
  trackId: string,
): Promise<TrackTodosResponse> {
  const content = await readTrackMarkdown(tracksDir, trackId);
  const title = parseTrackTitle(content, trackId);
  const todos = parseTodosFromMarkdown(content);
  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return {
    trackId,
    title,
    todos,
    progress,
    completedCount,
    totalCount,
    updatedAt: new Date().toISOString(),
  };
}

type TrackTodoSummary = {
  trackId: string;
  title: string;
  status?: string;
  progress: number;
  completedCount: number;
  totalCount: number;
};

type TrackMonitorEntry = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  progress: number;
  assignee?: string;
  description?: string;
  updated?: string;
  group?: TrackGroupId;
};

async function readTrackMeta(
  tracksDir: string,
  trackId: string,
): Promise<Record<string, unknown> | null> {
  const p = path.join(tracksDir, trackId, "meta.json");
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error: unknown) {
    const err = ensureError(error);
    logDebug("TracksRoutes", `Meta read failed for ${trackId}: ${err.message}`);
    return null;
  }
}

async function listTrackTodoSummaries(
  tracksDir: string,
  filterStatus?: (s: string | undefined) => boolean,
): Promise<TrackTodoSummary[]> {
  const entries = await fs.readdir(tracksDir, { withFileTypes: true });
  const out: TrackTodoSummary[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const trackId = e.name;
    if (!isSafeTrackId(trackId)) continue;

    const meta = await readTrackMeta(tracksDir, trackId);
    const status =
      typeof meta?.status === "string" ? (meta.status as string) : undefined;
    if (filterStatus && !filterStatus(status)) continue;

    try {
      const r = await buildTodosResponse(tracksDir, trackId);
      out.push({
        trackId,
        title: r.title,
        status,
        progress: r.progress,
        completedCount: r.completedCount,
        totalCount: r.totalCount,
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug("TracksRoutes", `Skipping track without track.md: ${trackId} - ${err.message}`);
    }
  }
  return out;
}

let watcherStarted = false;
let tracksWatcher: FSWatcher | null = null;

function toChokidarGlob(p: string): string {
  // chokidar globs are most reliable with forward slashes (esp. on Windows)
  return p.replaceAll("\\", "/");
}

function emitTrackChanged(trackId: string, reason?: string): void {
  socketService.emit("track:changed", {
    trackId,
    reason,
    timestamp: new Date().toISOString(),
  });
}

function startTrackWatcher(tracksDir: string): void {
  if (watcherStarted) return;
  watcherStarted = true;

  // Debounce bursty fs events (save can trigger multiple change events)
  const lastEmittedAt = new Map<string, number>();
  const shouldEmit = (key: string) => {
    const now = Date.now();
    const prev = lastEmittedAt.get(key) ?? 0;
    if (now - prev < 250) return false;
    lastEmittedAt.set(key, now);
    return true;
  };

  try {
    const trackGlob = toChokidarGlob(path.join(tracksDir, "*", "track.md"));
    const metaGlob = toChokidarGlob(path.join(tracksDir, "*", "meta.json"));

    tracksWatcher = chokidar.watch([trackGlob, metaGlob], {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    const onFsEvent = (event: string, filePath: string) => {
      const dir = path.basename(path.dirname(filePath));
      const base = path.basename(filePath);
      const trackId = dir;
      if (!trackId || !isSafeTrackId(trackId)) return;

      const key = `${trackId}:${base}`;
      if (!shouldEmit(key)) return;

      emitTrackChanged(trackId, `${event}:${base}`);
    };

    tracksWatcher
      .on("add", (p) => onFsEvent("add", p))
      .on("change", (p) => onFsEvent("change", p))
      .on("unlink", (p) => onFsEvent("unlink", p))
      .on("error", (err) => {
        const error = ensureError(err);
        logError("TracksRoutes", `Track watcher error: ${error.message}`);
      });

    logInfo("TracksRoutes", `Track watcher started (chokidar): ${tracksDir}`);
  } catch (error: unknown) {
    // If watcher cannot start, keep API functional (best-effort).
    const err = ensureError(error);
    logDebug("TracksRoutes", `Track watcher failed to start: ${err.message}`);
  }
}

export function createTracksRouter(opts?: {
  tracksDir?: string;
  enableWatcher?: boolean;
}): Router {
  const router = Router();
  const tracksDir = getTracksDir(opts?.tracksDir);
  const enableWatcher = opts?.enableWatcher !== false;
  if (enableWatcher) startTrackWatcher(tracksDir);

  /**
   * GET /api/tracks/todos
   * Returns todo summaries for all tracks.
   */
  router.get("/todos", async (_req, res) => {
    try {
      const tracks = await listTrackTodoSummaries(tracksDir);
      res.json({ success: true, count: tracks.length, tracks });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/tracks/todos/active
   * Returns todo summaries for active-ish tracks only.
   */
  router.get("/todos/active", async (_req, res) => {
    try {
      const active = await listTrackTodoSummaries(
        tracksDir,
        (s) => s === "active" || s === "in_progress" || s === "testing",
      );
      res.json({ success: true, count: active.length, tracks: active });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/tracks/monitor
   * Returns all tracks grouped by status (proposed / active / completed / archived).
   * Reads meta.json for each track folder — does not require track.md.
   */
  router.get("/monitor", async (_req, res) => {
    try {
      const entries = await fs.readdir(tracksDir, { withFileTypes: true });
      const proposed: TrackMonitorEntry[] = [];
      const active: TrackMonitorEntry[] = [];
      const completed: TrackMonitorEntry[] = [];
      const archived: TrackMonitorEntry[] = [];

      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const trackId = e.name;
        if (!isSafeTrackId(trackId)) continue;

        const meta = await readTrackMeta(tracksDir, trackId);
        if (!meta) continue;

        const status = typeof meta.status === "string" ? meta.status : "unknown";
        const title =
          typeof meta.title === "string"
            ? meta.title
            : typeof meta.name === "string"
              ? meta.name
              : trackId;
        const priority = typeof meta.priority === "string" ? meta.priority : undefined;
        const progress = typeof meta.progress === "number" ? meta.progress : 0;
        const assignee = typeof meta.assignee === "string" ? meta.assignee : undefined;
        const description = typeof meta.description === "string" ? meta.description : undefined;
        const updated = typeof meta.updated === "string" ? meta.updated : undefined;
        const rawTags = meta.tags;
        const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === "string") : [];
        const rawSourceDocument = meta.sourceDocument;
        const sourceDocument =
          typeof rawSourceDocument === "string" ? rawSourceDocument : undefined;
        const group = inferTrackGroup({
          id: trackId,
          title,
          description,
          sourceDocument,
          tags,
          group: meta.group,
        });

        const entry: TrackMonitorEntry = {
          id: trackId,
          title,
          status,
          priority,
          progress,
          assignee,
          description,
          updated,
          group,
        };

        if (status === "active" || status === "in_progress" || status === "testing") {
          active.push(entry);
        } else if (status === "proposed" || status === "planning") {
          proposed.push(entry);
        } else if (status === "completed" || status === "done") {
          completed.push(entry);
        } else if (status === "archived") {
          archived.push(entry);
        }
      }

      const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const sortMonitorEntries = (a: TrackMonitorEntry, b: TrackMonitorEntry) => {
        const groupDiff =
          TRACK_GROUP_ORDER.indexOf(a.group ?? "other") -
          TRACK_GROUP_ORDER.indexOf(b.group ?? "other");
        if (groupDiff !== 0) {
          return groupDiff;
        }

        const priorityDiff =
          (priorityOrder[a.priority ?? "P2"] ?? 2) -
          (priorityOrder[b.priority ?? "P2"] ?? 2);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return a.title.localeCompare(b.title);
      };
      proposed.sort(sortMonitorEntries);
      active.sort(sortMonitorEntries);
      completed.sort(sortMonitorEntries);
      archived.sort(sortMonitorEntries);

      res.json({
        success: true,
        stats: {
          total: proposed.length + active.length + completed.length + archived.length,
          proposed: proposed.length,
          active: active.length,
          completed: completed.length,
          archived: archived.length,
        },
        proposed,
        active,
        completed,
        archived,
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("TracksRoutes", `Monitor endpoint error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/tracks/generate
   * Generate EPP v2 compliant track from creative idea
   *
   * Request body:
   * {
   *   "idea": "Natural language idea (2-5 sentences, magyar OK)"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "trackId": "track-name-20260211",
   *   "trackPath": "conductor/tracks/track-name-20260211",
   *   "preview": "# Track Title\n\n..."
   * }
   */
  router.post("/generate", async (req, res) => {
    try {
      const { idea } = req.body;

      if (!idea || typeof idea !== "string") {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "idea" field in request body',
        });
      }

      logInfo(
        "TracksRoutes",
        `Generating track from idea: ${idea.slice(0, 60)}...`,
      );

      // Execute SpecWriterAgent with 3-stage pipeline
      const agent = agentManager.getAgent("SpecWriter");
      if (!agent) {
        return res.status(500).json({
          success: false,
          error: "SpecWriterAgent not registered in AgentManager",
        });
      }

      const result = (await agent.execute("Generate track", {
        metadata: { idea },
      })) as {
        status: "success" | "error";
        data?: any;
        error?: string;
      };

      if (result.status === "error") {
        logError("TracksRoutes", `Track generation failed: ${result.error}`);
        return res.status(500).json({
          success: false,
          error: result.error,
        });
      }

      const data = result.data as any;

      // Emit WebSocket event for real-time updates
      socketService.emit("track:generated", {
        trackId: data.trackId,
        timestamp: new Date().toISOString(),
      });

      logInfo("TracksRoutes", `✅ Track generated: ${data.trackId}`);

      res.json({
        success: true,
        trackId: data.trackId,
        trackPath: data.trackPath,
        trackFile: data.trackFile,
        preview: data.preview,
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("TracksRoutes", `Generate endpoint error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/tracks
   * List all tracks from conductor/tracks/ directory
   *
   * Response:
   * {
   *   "success": true,
   *   "tracks": [
   *     {
   *       "id": "track-name-20260211",
   *       "title": "Track Title",
   *       "priority": "P0",
   *       "progress": 0,
   *       "path": "conductor/tracks/track-name-20260211/track.md"
   *     }
   *   ]
   * }
   */
  router.get("/", async (_req, res) => {
    try {
      const agent = agentManager.getAgent("SpecWriter");
      if (!agent) {
        return res.status(500).json({
          success: false,
          error: "SpecWriterAgent not registered",
        });
      }

      // Call listTracks() method
      const result = (await (agent as any).listTracks()) as {
        success: boolean;
        message: string;
        data?: { tracks: any[] };
      };

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.message,
        });
      }

      const rawTracks = Array.isArray(result.data?.tracks) ? result.data.tracks : [];
      const tracks = await Promise.all(
        rawTracks.map(async (track: unknown) => {
          if (!track || typeof track !== "object") {
            return track;
          }

          const trackRecord = track as Record<string, unknown>;
          const trackId =
            typeof trackRecord.id === "string"
              ? trackRecord.id
              : typeof trackRecord.trackId === "string"
                ? trackRecord.trackId
                : undefined;

          if (!trackId || !isSafeTrackId(trackId)) {
            return trackRecord;
          }

          const meta = await readTrackMeta(tracksDir, trackId);
          const rawTags = meta?.tags;
          const tags = Array.isArray(rawTags)
            ? rawTags.filter((tag): tag is string => typeof tag === "string")
            : [];
          const rawSourceDocument = meta?.sourceDocument;
          const sourceDocument =
            typeof rawSourceDocument === "string" ? rawSourceDocument : undefined;
          const group = inferTrackGroup({
            id: trackId,
            title: typeof trackRecord.title === "string" ? trackRecord.title : undefined,
            name: typeof trackRecord.name === "string" ? trackRecord.name : undefined,
            description: typeof trackRecord.description === "string" ? trackRecord.description : undefined,
            sourceDocument,
            tags,
            group: meta?.group,
          });

          return { ...trackRecord, group };
        }),
      );

      res.json({
        success: true,
        count: tracks.length,
        tracks,
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("TracksRoutes", `List endpoint error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/tracks/:trackId
   * Get detailed track information (read track.md content)
   *
   * Response:
   * {
   *   "success": true,
   *   "trackId": "track-name-20260211",
   *   "content": "# Track Title\n\n...",
   *   "metadata": {
   *     "title": "Track Title",
   *     "priority": "P0",
   *     "progress": 0
   *   }
   * }
   */
  router.get("/:trackId", async (req, res) => {
    try {
      const { trackId } = req.params;

      if (!trackId || !isSafeTrackId(trackId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid trackId" });
      }

      // Read track.md file
      const trackPath = path.join(tracksDir, trackId, "track.md");

      let content = "";
      try {
        content = await fs.readFile(trackPath, "utf-8");
      } catch (error: unknown) {
        const err = ensureError(error);
        logError("TracksRoutes", `Track not found: ${trackId}`);
        return res.status(404).json({
          success: false,
          error: `Track not found: ${trackId}`,
        });
      }

      // Extract metadata from track.md (first 20 lines)
      const lines = content.split("\n").slice(0, 20);
      const title =
        lines
          .find((l) => l.startsWith("# "))
          ?.replace("# ", "")
          .trim() || trackId;
      const priorityMatch = lines.find((l) => l.includes("**Priority:**"));
      const priority = priorityMatch?.match(/P[0-2]/)?.[0] || "P2";
      const progressMatch = lines.find((l) => l.includes("**Progress:**"));
      const progress = parseInt(progressMatch?.match(/\d+/)?.[0] || "0", 10);
      const createdMatch = lines.find((l) => l.includes("**Created:**"));
      const created =
        createdMatch?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "unknown";

      res.json({
        success: true,
        trackId,
        content,
        metadata: {
          title,
          priority,
          progress,
          created,
          path: trackPath,
        },
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("TracksRoutes", `Get endpoint error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * GET /api/tracks/:trackId/todos
   * Parse all checkbox TODOs from track.md.
   */
  router.get("/:trackId/todos", async (req, res) => {
    try {
      const { trackId } = req.params;
      if (!trackId || !isSafeTrackId(trackId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid trackId" });
      }

      const data = await buildTodosResponse(tracksDir, trackId);
      res.json({ success: true, ...data });
    } catch (error: unknown) {
      const err = ensureError(error);
      const msg = err.message;
      const status = /not found/i.test(msg) ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  });

  /**
   * PATCH /api/tracks/:trackId/todos/:todoId
   * Toggle a specific checkbox line by id=line:<n>
   */
  router.patch("/:trackId/todos/:todoId", async (req, res) => {
    try {
      const { trackId, todoId } = req.params;
      if (!trackId || !isSafeTrackId(trackId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid trackId" });
      }

      const m = /^line:(\d+)$/.exec(String(todoId || ""));
      if (!m) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid todoId" });
      }
      const lineIndex = parseInt(m[1], 10);
      const desired =
        typeof req.body?.completed === "boolean"
          ? (req.body.completed as boolean)
          : undefined;

      const current = await readTrackMarkdown(tracksDir, trackId);
      const next = toggleTodoLine(current, lineIndex, desired);
      await writeTrackMarkdown(tracksDir, trackId, next);

      socketService.emit("track:todo_updated", {
        trackId,
        todoId,
        timestamp: new Date().toISOString(),
      });

      const data = await buildTodosResponse(tracksDir, trackId);
      res.json({ success: true, ...data });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/tracks/:trackId/detail
   * Returns meta.json + plan.md + spec.md content for a single track.
   */
  router.get("/:trackId/detail", async (req, res) => {
    try {
      const { trackId } = req.params;
      if (!trackId || !isSafeTrackId(trackId)) {
        res.status(400).json({ success: false, error: "Invalid trackId" });
        return;
      }

      const meta = await readTrackMeta(tracksDir, trackId);
      if (!meta) {
        res.status(404).json({ success: false, error: "Track not found" });
        return;
      }

      const readOptional = async (filename: string): Promise<string | null> => {
        try {
          const content = await fs.readFile(
            path.join(tracksDir, trackId, filename),
            "utf-8",
          );
          return content;
        } catch {
          return null;
        }
      };

      const [planMd, specMd, trackMd] = await Promise.all([
        readOptional("plan.md"),
        readOptional("spec.md"),
        readOptional("track.md"),
      ]);

      const title =
        typeof meta.title === "string"
          ? meta.title
          : typeof meta.name === "string"
            ? meta.name
            : trackId;
      const rawTags = meta.tags;
      const tags = Array.isArray(rawTags)
        ? rawTags.filter((tag): tag is string => typeof tag === "string")
        : [];
      const rawSourceDocument = meta.sourceDocument;
      const sourceDocument =
        typeof rawSourceDocument === "string" ? rawSourceDocument : undefined;
      const group = inferTrackGroup({
        id: trackId,
        title,
        description: typeof meta.description === "string" ? meta.description : undefined,
        sourceDocument,
        tags,
        group: meta.group,
      });

      res.json({
        success: true,
        id: trackId,
        title,
        status: meta.status ?? "unknown",
        priority: meta.priority,
        progress: meta.progress ?? 0,
        assignee: meta.assignee,
        description: meta.description,
        updated: meta.updated,
        group,
        planMd,
        specMd,
        trackMd,
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("TracksRoutes", `Detail endpoint error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
