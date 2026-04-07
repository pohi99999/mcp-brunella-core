import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createTracksRouter } from "../src/server/tracksRoutes.js";

async function mkTrackDir(
  root: string,
  trackId: string,
  meta: Record<string, unknown>,
  files: Record<string, string> = {},
) {
  const dir = path.join(root, trackId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content);
  }
}

describe("ConductorTracksMonitor route – GET /monitor", () => {
  let tracksDir: string;
  let app: express.Express;

  beforeEach(async () => {
    tracksDir = await fs.mkdtemp(path.join(os.tmpdir(), "monitor-route-"));

    await mkTrackDir(tracksDir, "active-p0-track", {
      status: "active",
      title: "Active P0",
      priority: "P0",
      progress: 40,
      assignee: "Copilot",
      description: "High priority active",
      updated: "2026-04-01",
    });

    await mkTrackDir(tracksDir, "active-p1-track", {
      status: "active",
      title: "Active P1",
      priority: "P1",
      progress: 20,
    });

    await mkTrackDir(tracksDir, "proposed-track", {
      status: "proposed",
      title: "Proposed Track",
      priority: "P2",
      progress: 0,
    });

    await mkTrackDir(tracksDir, "completed-track", {
      status: "completed",
      title: "Completed Track",
      progress: 100,
    });

    await mkTrackDir(tracksDir, "archived-track", {
      status: "archived",
      title: "Archived Track",
      progress: 0,
    });

    // Track folder without meta.json — should be silently skipped
    await fs.mkdir(path.join(tracksDir, "no-meta-track"), { recursive: true });

    app = express();
    app.use(express.json());
    app.use(
      "/api/v1/tracks",
      createTracksRouter({ tracksDir, enableWatcher: false }),
    );
  });

  afterEach(async () => {
    await fs.rm(tracksDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns 200 with tracks grouped by status", async () => {
    const res = await request(app).get("/api/v1/tracks/monitor");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns correct stats counts", async () => {
    const res = await request(app).get("/api/v1/tracks/monitor");
    const { stats } = res.body as {
      stats: { total: number; proposed: number; active: number; completed: number; archived: number };
    };
    expect(stats.active).toBe(2);
    expect(stats.proposed).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.archived).toBe(1);
    expect(stats.total).toBe(5);
  });

  it("active tracks are sorted P0 before P1", async () => {
    const res = await request(app).get("/api/v1/tracks/monitor");
    const active = res.body.active as Array<{ id: string; priority?: string }>;
    expect(active[0].priority).toBe("P0");
    expect(active[1].priority).toBe("P1");
  });

  it("each entry has required fields", async () => {
    const res = await request(app).get("/api/v1/tracks/monitor");
    const entry = (res.body.active as Array<Record<string, unknown>>)[0];
    expect(typeof entry.id).toBe("string");
    expect(typeof entry.title).toBe("string");
    expect(typeof entry.status).toBe("string");
    expect(typeof entry.progress).toBe("number");
  });

  it("active entry includes optional metadata fields when present", async () => {
    const res = await request(app).get("/api/v1/tracks/monitor");
    const p0 = (res.body.active as Array<Record<string, unknown>>).find(
      (e) => e.id === "active-p0-track",
    );
    expect(p0).toBeDefined();
    expect(p0?.assignee).toBe("Copilot");
    expect(p0?.description).toBe("High priority active");
    expect(p0?.updated).toBe("2026-04-01");
    expect(p0?.progress).toBe(40);
  });

  it("tracks without meta.json are silently skipped", async () => {
    const res = await request(app).get("/api/v1/tracks/monitor");
    const allIds = [
      ...res.body.active,
      ...res.body.proposed,
      ...res.body.completed,
      ...res.body.archived,
    ].map((e: { id: string }) => e.id);
    expect(allIds).not.toContain("no-meta-track");
  });
});

describe("ConductorTracksMonitor route – GET /:trackId/detail", () => {
  let tracksDir: string;
  let app: express.Express;

  beforeEach(async () => {
    tracksDir = await fs.mkdtemp(path.join(os.tmpdir(), "detail-route-"));

    await mkTrackDir(
      tracksDir,
      "full-track",
      {
        status: "active",
        title: "Full Track",
        priority: "P1",
        progress: 55,
        assignee: "Dev",
        description: "A complete track",
        updated: "2026-04-02",
      },
      {
        "plan.md": "# Plan\n\nStep 1\nStep 2",
        "spec.md": "# Spec\n\nAcceptance criteria here",
        "track.md": "# Track\n\n- [x] Done\n- [ ] Todo",
      },
    );

    await mkTrackDir(tracksDir, "meta-only-track", {
      status: "proposed",
      title: "Meta Only",
      progress: 0,
    });

    app = express();
    app.use(express.json());
    app.use(
      "/api/v1/tracks",
      createTracksRouter({ tracksDir, enableWatcher: false }),
    );
  });

  afterEach(async () => {
    await fs.rm(tracksDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns 200 with meta fields for a full track", async () => {
    const res = await request(app).get("/api/v1/tracks/full-track/detail");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe("full-track");
    expect(res.body.title).toBe("Full Track");
    expect(res.body.status).toBe("active");
    expect(res.body.priority).toBe("P1");
    expect(res.body.progress).toBe(55);
    expect(res.body.assignee).toBe("Dev");
    expect(res.body.description).toBe("A complete track");
    expect(res.body.updated).toBe("2026-04-02");
  });

  it("returns markdown file contents when files exist", async () => {
    const res = await request(app).get("/api/v1/tracks/full-track/detail");
    expect(typeof res.body.planMd).toBe("string");
    expect(res.body.planMd).toContain("Step 1");
    expect(typeof res.body.specMd).toBe("string");
    expect(res.body.specMd).toContain("Acceptance criteria");
    expect(typeof res.body.trackMd).toBe("string");
    expect(res.body.trackMd).toContain("Done");
  });

  it("returns null for missing optional markdown files", async () => {
    const res = await request(app).get("/api/v1/tracks/meta-only-track/detail");
    expect(res.status).toBe(200);
    expect(res.body.planMd).toBeNull();
    expect(res.body.specMd).toBeNull();
    expect(res.body.trackMd).toBeNull();
  });

  it("path traversal is rejected (Express normalizes, no route match)", async () => {
    // Express normalizes /../ before reaching the handler, so the route
    // simply doesn't match — the traversal is prevented at the routing level.
    const res = await request(app).get("/api/v1/tracks/../etc/detail");
    expect(res.status).not.toBe(200);
  });

  it("returns 404 when track has no meta.json", async () => {
    // Create dir without meta.json
    await fs.mkdir(path.join(tracksDir, "ghost-track"), { recursive: true });
    const res = await request(app).get("/api/v1/tracks/ghost-track/detail");
    expect(res.status).toBe(404);
  });

  it("GET /monitor is not intercepted as /:trackId", async () => {
    // This verifies the route ordering: /monitor must match before /:trackId
    const res = await request(app).get("/api/v1/tracks/monitor");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // If routing were wrong, monitor would be treated as trackId and return 404
    expect(res.body.active).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });
});
