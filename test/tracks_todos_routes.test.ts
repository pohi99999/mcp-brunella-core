import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createTracksRouter } from "../src/server/tracksRoutes.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getString(v: unknown, key: string): string | undefined {
  if (!isRecord(v)) return undefined;
  const val = v[key];
  return typeof val === "string" ? val : undefined;
}

function getBool(v: unknown, key: string): boolean | undefined {
  if (!isRecord(v)) return undefined;
  const val = v[key];
  return typeof val === "boolean" ? val : undefined;
}

async function mkTrack(
  root: string,
  trackId: string,
  opts: { status?: string; trackMd: string; meta?: Record<string, unknown> },
) {
  const dir = path.join(root, trackId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "track.md"), opts.trackMd, "utf-8");

  const meta = {
    id: trackId,
    title: trackId,
    status: opts.status ?? "active",
    ...(opts.meta || {}),
  };
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
}

describe("Tracks todos routes", () => {
  let tempTracksDir: string;
  let app: express.Express;

  beforeEach(async () => {
    tempTracksDir = await fs.mkdtemp(path.join(os.tmpdir(), "tracks-todos-"));

    await mkTrack(tempTracksDir, "active-track-1", {
      status: "active",
      trackMd: [
        "# Active Track",
        "",
        "- [ ] First",
        "- [x] Second",
        "- [ ] Third",
      ].join("\n"),
      meta: { title: "Active Track" },
    });

    await mkTrack(tempTracksDir, "proposed-track-1", {
      status: "proposed",
      trackMd: ["# Proposed Track", "", "- [ ] One"].join("\n"),
    });

    app = express();
    app.use(express.json());
    app.use(
      "/api/v1/tracks",
      createTracksRouter({ tracksDir: tempTracksDir, enableWatcher: false }),
    );
  });

  afterEach(async () => {
    await fs.rm(tempTracksDir, { recursive: true, force: true }).catch(() => {});
  });

  it("GET /api/v1/tracks/:trackId/todos parses checkbox todos", async () => {
    const res = await request(app).get("/api/v1/tracks/active-track-1/todos");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trackId).toBe("active-track-1");
    expect(res.body.todos.length).toBe(3);
    expect(res.body.completedCount).toBe(1);
    expect(res.body.totalCount).toBe(3);
    expect(res.body.progress).toBe(33);
  });

  it("PATCH /api/v1/tracks/:trackId/todos/:todoId toggles a line", async () => {
    // line indexes: 0 '#', 1 '', 2 First, 3 Second, 4 Third
    const res = await request(app)
      .patch("/api/v1/tracks/active-track-1/todos/line:2")
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.completedCount).toBe(2);

    const read = await request(app).get("/api/v1/tracks/active-track-1/todos");
    expect(read.body.completedCount).toBe(2);
    const todos = Array.isArray(read.body.todos) ? (read.body.todos as unknown[]) : [];
    const found = todos.find((t) => getString(t, "id") === "line:2");
    expect(getBool(found, "completed")).toBe(true);
  });

  it("GET /api/v1/tracks/todos/active returns only active-ish tracks", async () => {
    const res = await request(app).get("/api/v1/tracks/todos/active");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const tracks = Array.isArray(res.body.tracks) ? (res.body.tracks as unknown[]) : [];
    const ids = tracks.map((t) => getString(t, "trackId")).filter(Boolean);
    expect(ids).toContain("active-track-1");
    expect(ids).not.toContain("proposed-track-1");
  });
});
