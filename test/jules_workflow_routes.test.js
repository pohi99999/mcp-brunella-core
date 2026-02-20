import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createJulesRoutes } from "../src/server/routes/jules.js";
describe("Jules workflow routes", () => {
    let app;
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use("/api/jules", createJulesRoutes());
    });
    it("GET /api/jules/workflow-runs returns 503 when GITHUB_TOKEN missing", async () => {
        const prev = {
            GITHUB_TOKEN: process.env.GITHUB_TOKEN,
            GH_TOKEN: process.env.GH_TOKEN,
            GITHUB_PAT: process.env.GITHUB_PAT,
        };
        delete process.env.GITHUB_TOKEN;
        delete process.env.GH_TOKEN;
        delete process.env.GITHUB_PAT;
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            throw new Error("fetch should not be called when token is missing");
        });
        const res = await request(app).get("/api/jules/workflow-runs");
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/token/i);
        fetchSpy.mockRestore();
        if (prev.GITHUB_TOKEN)
            process.env.GITHUB_TOKEN = prev.GITHUB_TOKEN;
        if (prev.GH_TOKEN)
            process.env.GH_TOKEN = prev.GH_TOKEN;
        if (prev.GITHUB_PAT)
            process.env.GITHUB_PAT = prev.GITHUB_PAT;
    });
    it("POST /api/jules/dispatch returns 503 when GITHUB_TOKEN missing", async () => {
        const prev = {
            GITHUB_TOKEN: process.env.GITHUB_TOKEN,
            GH_TOKEN: process.env.GH_TOKEN,
            GITHUB_PAT: process.env.GITHUB_PAT,
        };
        delete process.env.GITHUB_TOKEN;
        delete process.env.GH_TOKEN;
        delete process.env.GITHUB_PAT;
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            throw new Error("fetch should not be called when token is missing");
        });
        const res = await request(app).post("/api/jules/dispatch").send({});
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/token/i);
        fetchSpy.mockRestore();
        if (prev.GITHUB_TOKEN)
            process.env.GITHUB_TOKEN = prev.GITHUB_TOKEN;
        if (prev.GH_TOKEN)
            process.env.GH_TOKEN = prev.GH_TOKEN;
        if (prev.GITHUB_PAT)
            process.env.GITHUB_PAT = prev.GITHUB_PAT;
    });
    it("GET /api/jules/workflow-runs returns runs when fetch succeeds", async () => {
        process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || "test-token";
        process.env.GITHUB_REPOSITORY = "owner/repo";
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => JSON.stringify({
                workflow_runs: [
                    {
                        id: 1,
                        run_number: 12,
                        status: "completed",
                        conclusion: "success",
                        updated_at: "2026-02-12T00:00:00Z",
                    },
                ],
            }),
        });
        const res = await request(app)
            .get("/api/jules/workflow-runs")
            .query({ workflow: "jules-async-tests.yml", limit: "2" });
        expect(res.status).toBe(200);
        expect(res.body.runs?.length).toBe(1);
        expect(res.body.runs[0]).toEqual(expect.objectContaining({ id: 1, conclusion: "success" }));
        fetchSpy.mockRestore();
    });
});
