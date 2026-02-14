import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

vi.mock("../src/server/SocketService.js", () => ({
  socketService: {
    emit: vi.fn(),
  },
}));

import { createMemoryRouter } from "../src/server/memoryRoutes.js";

type MockResponse = {
  ok: boolean;
  statusText?: string;
  json: () => Promise<unknown>;
};

describe("memoryRoutes /golden", () => {
  let fetchSpy: any;

  beforeEach(() => {
    // Spy on global.fetch and mock implementation
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use("/memory", createMemoryRouter());
    return app;
  }

  it("maps legacy input/output payload to prompt/completion", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success" }),
    } as MockResponse);

    const app = createApp();

    const response = await request(app).post("/memory/golden").send({
      source: "legacy-ui",
      input: "legacy prompt",
      output: "legacy completion",
      quality: 80,
    });

    if (response.status !== 200) {
        console.error("Fail:", response.body);
    }
    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [, options] = fetchSpy.mock.calls[0] as [string, { body?: unknown }];
    const body = JSON.parse(String(options.body)) as {
      source: string;
      prompt: string;
      completion: string;
      quality: number;
    };

    expect(body).toEqual({
      source: "legacy-ui",
      prompt: "legacy prompt",
      completion: "legacy completion",
      quality: 0.8,
    });
  });

  it("accepts prompt/completion and defaults quality to 1.0", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success" }),
    } as MockResponse);

    const app = createApp();

    const response = await request(app).post("/memory/golden").send({
      source: "new-ui",
      prompt: "new prompt",
      completion: "new completion",
    });

    expect(response.status).toBe(200);

    const [, options] = fetchSpy.mock.calls[0] as [string, { body?: unknown }];
    const body = JSON.parse(String(options.body)) as {
      quality: number;
      prompt: string;
      completion: string;
    };

    expect(body.prompt).toBe("new prompt");
    expect(body.completion).toBe("new completion");
    expect(body.quality).toBe(1);
  });

  it("returns 400 when required fields are missing", async () => {
    const app = createApp();

    const response = await request(app).post("/memory/golden").send({
      source: "incomplete",
      prompt: "missing completion",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("required");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
