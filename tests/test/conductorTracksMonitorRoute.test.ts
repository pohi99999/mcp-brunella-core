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

    await mkTrackDir(tracksDir, "paused-track", {
      status: "paused",
      title: "Paused Track",
      priority: "P2",
      progress: 60,
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
    expect(stats.active).toBe(3);
    expect(stats.proposed).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.archived).toBe(1);
    expect(stats.total).toBe(6);
  });

  it("active tracks are sorted P0 before P1", async () => {
    const res = await request(app).get("/api/v1/tracks/monitor");
    const active = res.body.active as Array<{ id: string; priority?: string; status?: string }>;
    expect(active[0].priority).toBe("P0");
    expect(active[1].priority).toBe("P1");
    expect(active[2].status).toBe("paused");
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

describe("ConductorTracksMonitor route – GET /status", () => {
  let tracksDir: string;
  let app: express.Express;

  beforeEach(async () => {
    tracksDir = await fs.mkdtemp(path.join(os.tmpdir(), "status-route-"));

    await mkTrackDir(tracksDir, "business-critical-track", {
      id: "business-critical-track",
      title: "Invoice automation",
      status: "active",
      priority: "critical",
      progress: 42,
      assignee: "Ops",
      group: "business",
    });

    await mkTrackDir(tracksDir, "business-high-track", {
      id: "business-high-track",
      title: "Lead routing",
      status: "active",
      priority: "high",
      progress: 18,
      group: "business",
    });

    await mkTrackDir(tracksDir, "business-proposed-track", {
      id: "business-proposed-track",
      title: "Customer follow-up",
      status: "proposed",
      priority: "medium",
      progress: 0,
      group: "business",
    });

    await mkTrackDir(tracksDir, "business-completed-track", {
      id: "business-completed-track",
      title: "Cash register sync",
      status: "completed",
      priority: "medium",
      progress: 100,
      group: "business",
      completed: "2026-04-01",
    });

    await mkTrackDir(tracksDir, "business-archived-track", {
      id: "business-archived-track",
      title: "Retail migration",
      status: "archived",
      priority: "low",
      progress: 100,
      group: "business",
    });

    await mkTrackDir(tracksDir, "nova-track", {
      id: "nova-track",
      title: "Morning briefing",
      status: "active",
      priority: "high",
      progress: 65,
      group: "nova",
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

  it("returns a read-only KKV masterplan snapshot", async () => {
    const res = await request(app).get("/api/v1/tracks/status");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.checkedAt).toBe("string");
    expect(res.body.overallStats).toEqual({
      total: 6,
      active: 3,
      proposed: 1,
      completed: 1,
      archived: 1,
    });
    expect(res.body.businessGroupStats).toEqual({
      total: 5,
      active: 2,
      proposed: 1,
      completed: 1,
      archived: 1,
      averageProgress: 52,
      critical: 1,
      high: 1,
      medium: 2,
      low: 1,
    });
    expect(Array.isArray(res.body.activeBusinessTracks)).toBe(true);
    expect(res.body.activeBusinessTracks[0].id).toBe("business-critical-track");
    expect(res.body.recommendation.focusTrackId).toBe("business-critical-track");
    expect(res.body.recommendation.nextSteps.length).toBeGreaterThan(0);
    expect(
      res.body.activeBusinessTracks.some((track: { id: string }) => track.id === "nova-track"),
    ).toBe(false);
  });
});
