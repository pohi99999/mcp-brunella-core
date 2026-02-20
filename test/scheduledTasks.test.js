import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { ScheduledTasksEngine } from "../src/core/scheduledTasksEngine.js";
import { createScheduledTasksRoutes } from "../src/server/routes/scheduledTasks.js";
// Mock dependencies
vi.mock("../src/utils/logger.js", () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
}));
// Mock node-cron to avoid ESM issues and timer complexity
vi.mock("node-cron", () => ({
    default: {
        validate: vi.fn((pattern) => pattern !== "invalid pattern"),
        schedule: vi.fn(() => ({
            start: vi.fn(),
            stop: vi.fn(),
        })),
    },
    validate: vi.fn((pattern) => pattern !== "invalid pattern"),
    schedule: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
    })),
}));
describe("ScheduledTasksEngine Integráció", () => {
    let db;
    let engine;
    let app;
    let tempDbPath;
    beforeEach(async () => {
        // Setup DB
        tempDbPath = path.join(os.tmpdir(), `test_scheduled_${Date.now()}.db`);
        db = new Database(tempDbPath);
        // Create schema manually for test (usually in schema.sql)
        db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        handler TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        last_status TEXT,
        last_result TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
        // Initialize Engine
        engine = new ScheduledTasksEngine(db);
        // Inject engine into request for the router (simulating middleware)
        app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.scheduledTasksEngine = engine;
            next();
        });
        app.use("/api/v1/scheduled-tasks", createScheduledTasksRoutes(db));
    });
    afterEach(async () => {
        db.close();
        try {
            await fs.unlink(tempDbPath);
        }
        catch { /* non-critical */ }
        vi.restoreAllMocks();
    });
    describe("Engine Logic", () => {
        it("should schedule a valid task", () => {
            const task = {
                id: "task_1",
                title: "Test Task",
                cron_expression: "* * * * *", // Every minute
                handler: "test-handler",
                prompt: "do something",
                method: "GET",
                enabled: true,
                created_at: new Date().toISOString()
            };
            // @ts-expect-error The task object type mismatch is intentional for this test case.
            const result = engine.scheduleTask(task);
            expect(result.success).toBe(true);
            expect(result.message).toContain("scheduled");
        });
        it("should reject invalid cron pattern", () => {
            const task = {
                id: "task_bad",
                task_name: "Bad Task",
                cron_pattern: "invalid pattern",
                api_endpoint: "/test",
                method: "GET",
                enabled: true,
                created_at: new Date().toISOString()
            };
            const result = engine.scheduleTask(task);
            expect(result.success).toBe(false);
            expect(result.message).toContain("Invalid cron pattern");
        });
    });
    describe("API Endpoints", () => {
        it.skip("should list tasks", async () => {
            db.prepare(`
        INSERT INTO scheduled_tasks (id, title, cron_expression, handler, prompt, enabled)
        VALUES ('t1', 'API Test', '0 * * * *', 'test', 'prompt', 1)
      `).run();
            const response = await request(app).get("/api/v1/scheduled-tasks");
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].id).toBe("t1");
        });
        it("should create a new task", async () => {
            const newTask = {
                title: "New Task",
                cron_expression: "0 0 * * *",
                handler: "api-call",
                prompt: "Run this task"
            };
            const response = await request(app)
                .post("/api/v1/scheduled-tasks")
                .send(newTask);
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe("New Task");
            // Verify in DB
            const row = db.prepare("SELECT * FROM scheduled_tasks WHERE title = ?").get("New Task");
            expect(row).toBeDefined();
        });
    });
});
