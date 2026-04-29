import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createN8nRoutes } from "@apps/mcp-core/server/routes/external.js";
import {
  N8nClient,
  sanitizeWorkflowForWrite,
} from "@packages/utils/n8nClient.js";

describe("N8nClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("removes read-only workflow fields before write operations", () => {
    const sanitized = sanitizeWorkflowForWrite({
      id: "wf-1",
      name: "Könyvelés",
      active: true,
      versionId: "12",
      meta: { readonly: true },
      tags: [{ id: "tag-1", name: "bookkeeping" }],
      nodes: [],
      connections: {},
      settings: { timezone: "Europe/Budapest" },
    });

    expect(sanitized).toEqual({
      name: "Könyvelés",
      active: true,
      nodes: [],
      connections: {},
      settings: { timezone: "Europe/Budapest" },
    });
  });

  it("posts a sanitized workflow when creating workflows", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "wf-2", name: "Fresh workflow" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new N8nClient({
      baseUrl: "http://localhost:5678",
      apiKey: "secret",
      timeoutMs: 10_000,
    });

    const result = await client.createWorkflow({
      id: "stale-id",
      name: "Fresh workflow",
      versionId: "7",
      meta: { ignored: true },
      tags: [{ id: "tag-1" }],
      nodes: [],
      connections: {},
      settings: {},
    });

    expect(result).toEqual({ id: "wf-2", name: "Fresh workflow" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:5678/api/v1/workflows");
    expect(options).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-N8N-API-KEY": "secret",
      }),
      body: JSON.stringify({
        name: "Fresh workflow",
        nodes: [],
        connections: {},
        settings: {},
      }),
    });
  });

  it("posts workflow execution requests to the run endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: "exec-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new N8nClient({
      baseUrl: "http://localhost:5678",
      apiKey: "secret",
    });

    const result = await client.triggerWorkflow("wf-4", {
      source: "bookkeeping",
      amount: 1250,
    });

    expect(result).toEqual({ executionId: "exec-1" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:5678/api/v1/workflows/wf-4/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          source: "bookkeeping",
          amount: 1250,
        }),
      }),
    );
  });

  it("renames an existing workflow by fetching and updating it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "wf-3",
            name: "Original name",
            nodes: [{ type: "manualTrigger" }],
            connections: {},
            settings: { saveManualExecutions: true },
            tags: [{ id: "tag-1", name: "keep-out" }],
            versionId: "9",
            meta: { ignored: true },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "wf-3", name: "Renamed workflow" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new N8nClient({
      baseUrl: "http://localhost:5678",
      apiKey: "secret",
    });

    const result = await client.renameWorkflow("wf-3", "Renamed workflow");

    expect(result).toEqual({ id: "wf-3", name: "Renamed workflow" });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:5678/api/v1/workflows/wf-3",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:5678/api/v1/workflows/wf-3",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: "Renamed workflow",
          nodes: [{ type: "manualTrigger" }],
          connections: {},
          settings: { saveManualExecutions: true },
        }),
      }),
    );
  });
});

describe("N8n routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("N8N_BASE_URL", "http://localhost:5678");
    vi.stubEnv("N8N_API_KEY", "secret");

    app = express();
    app.use(express.json());
    app.use("/api/n8n", createN8nRoutes());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("GET /api/n8n/workflows proxies the list response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "wf-1",
              name: "Könyvelés pipeline",
              active: true,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const res = await request(app).get("/api/n8n/workflows");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: "wf-1",
        name: "Könyvelés pipeline",
        active: true,
      }),
    );
  });
});
