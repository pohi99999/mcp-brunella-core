import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { suggestedTasksRouter } from "@apps/mcp-core/server/routes/suggestedTasks.js";
import { initSuggestedTasksDb, getSuggestedTasksDb } from "@packages/core-logic/suggestedTasksScanner.js";

interface TaskRecord {
  id: string;
  todo_text: string;
  file_path: string;
  line_number: number;
  confidence_score: number;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const entry = value[key];
  return typeof entry === "string" ? entry : undefined;
}

function getNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const entry = value[key];
  return typeof entry === "number" ? entry : undefined;
}

function getArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return [];
  const entry = value[key];
  return Array.isArray(entry) ? entry : [];
}

async function seedWorkspace(root: string) {
  const srcDir = path.join(root, "src");
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "sample.ts"),
    "// TODO CRITICAL: fix this\nconst sample = true;\n",
    "utf-8",
  );
}

function insertTask(status = "pending"): TaskRecord {
  const db = getSuggestedTasksDb();
  if (!db) throw new Error("Suggested tasks DB not initialized");

  const id = `todo_test_${status}`;
  db.prepare(
    `
      INSERT OR REPLACE INTO suggested_tasks
      (id, file_path, line_number, todo_text, context, confidence_score, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `,
  ).run(id, "src/sample.ts", 1, "TODO: test", "context", 0.7, status);

  return {
    id,
    todo_text: "TODO: test",
    file_path: "src/sample.ts",
    line_number: 1,
    confidence_score: 0.7,
    status,
  };
}

describe("SuggestedTasksScanner API Routes", () => {
  let app: express.Express;
  let tempDir: string;
  const prevEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "suggested-tasks-"));
    await seedWorkspace(tempDir);
    process.env.BRUNELLA_WORKSPACE_ROOT = tempDir;

    await initSuggestedTasksDb(":memory:");

    app = express();
    app.use(express.json());
    app.use("/api/v1/suggested-tasks", suggestedTasksRouter);
  });

  afterEach(async () => {
    process.env = { ...prevEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("GET /api/v1/suggested-tasks", () => {
    it("should return all non-archived tasks", async () => {
      insertTask("pending");
      const response = await request(app).get("/api/v1/suggested-tasks");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe("GET /api/v1/suggested-tasks/:status", () => {
    it("should filter tasks by pending status", async () => {
      insertTask("pending");
      insertTask("in_progress");

      const response = await request(app).get("/api/v1/suggested-tasks/pending");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const tasks = Array.isArray(response.body.data) ? response.body.data : [];
      tasks.forEach((task: unknown) => {
        expect(getString(task, "status")).toBe("pending");
      });
    });

    it("should filter tasks by in_progress status", async () => {
      insertTask("in_progress");
      const response = await request(app).get("/api/v1/suggested-tasks/in_progress");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 400 for invalid status", async () => {
      const response = await request(app).get("/api/v1/suggested-tasks/invalid_status");
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/suggested-tasks/scan", () => {
    it("should scan codebase and return new tasks", async () => {
      const response = await request(app).post("/api/v1/suggested-tasks/scan");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const count = getNumber(response.body.data, "count");
      expect(typeof count).toBe("number");
    });
  });

  describe("PATCH /api/v1/suggested-tasks/:taskId/status", () => {
    it("should update task status successfully", async () => {
      const task = insertTask("pending");

      const response = await request(app)
        .patch(`/api/v1/suggested-tasks/${task.id}/status`)
        .send({ status: "in_progress" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(getString(response.body.data, "status")).toBe("in_progress");
    });

    it("should return 400 for invalid status value", async () => {
      const response = await request(app)
        .patch("/api/v1/suggested-tasks/test-id/status")
        .send({ status: "invalid" });

      expect(response.status).toBe(400);
    });

    it("should return 404 for non-existent task", async () => {
      const response = await request(app)
        .patch("/api/v1/suggested-tasks/nonexistent-id/status")
        .send({ status: "completed" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/suggested-tasks/:taskId", () => {
    it("should archive a task successfully", async () => {
      const task = insertTask("pending");

      const response = await request(app).delete(`/api/v1/suggested-tasks/${task.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.archived).toBe(true);
    });

    it("should return 404 for non-existent task", async () => {
      const response = await request(app).delete("/api/v1/suggested-tasks/nonexistent-id");
      expect(response.status).toBe(404);
    });
  });

  describe("Scanner Confidence Scoring", () => {
    it("should assign higher confidence to critical keywords", async () => {
      const response = await request(app).post("/api/v1/suggested-tasks/scan");
      expect(response.status).toBe(200);

      const tasks = getArray(response.body.data, "tasks");
      tasks.forEach((task) => {
        const score = getNumber(task, "confidence_score");
        expect(typeof score).toBe("number");
        if (typeof score === "number") {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      });

      const criticalTasks = tasks.filter((task) => {
        const text = getString(task, "todo_text");
        return text?.toLowerCase().includes("critical") ?? false;
      });

      if (criticalTasks.length > 0) {
        const score = getNumber(criticalTasks[0], "confidence_score");
        expect(score).toBeGreaterThan(0.5);
      }
    });
  });
});
