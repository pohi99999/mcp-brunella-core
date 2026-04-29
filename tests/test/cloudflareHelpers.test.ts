import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCloudflareWorkersInventory,
  postTaskToWorker,
  type WorkerDefinition,
} from "@packages/core-logic/cloudflare/cloudflareHelpers.js";

function makeWorker(overrides: Partial<WorkerDefinition> = {}): WorkerDefinition {
  return {
    id: "agents-api",
    name: "agents-api",
    url: "https://worker.example",
    kind: "internal",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("cloudflareHelpers", () => {
  it("builds the worker inventory from configured environment values", () => {
    vi.stubEnv("CLOUDFLARE_D1_WORKER_URL", "https://orchestrator.example");
    vi.stubEnv("CLOUDFLARE_CHAT_SYNC_URL", "https://chat-sync.example");
    vi.stubEnv("CLOUDFLARE_CHAT_URL", "https://chat.example");
    vi.stubEnv("CF_WORKER_AGENTS_API_URL", "https://agents.example");
    vi.stubEnv("CF_WORKER_SAAS_ADMIN_URL", "https://saas.example");
    vi.stubEnv("CF_WORKER_THROBBING_FIRE_URL", "https://fire.example");

    const inventory = getCloudflareWorkersInventory();

    expect(inventory).toHaveLength(7);
    expect(inventory.find((worker) => worker.id === "cean-orchestrator")?.url).toBe(
      "https://orchestrator.example",
    );
    expect(inventory.find((worker) => worker.id === "chat-sync")?.url).toBe(
      "https://chat-sync.example",
    );
    expect(inventory.find((worker) => worker.id === "llm-chat-app-template")?.url).toBe(
      "https://chat.example",
    );
    expect(inventory.find((worker) => worker.id === "agents-api")?.url).toBe(
      "https://agents.example",
    );
    expect(inventory.find((worker) => worker.id === "saas-admin")?.url).toBe(
      "https://saas.example",
    );
    expect(inventory.find((worker) => worker.id === "throbbing-fire")?.url).toBe(
      "https://fire.example",
    );
  });

  it("posts tasks to the worker and retries alternative endpoints", async () => {
    vi.stubEnv("CF_BAS_API_TOKEN", "bas-token");
    vi.stubEnv("CEAN_API_KEY", "cean-token");

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("temporary failure", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, result: { handled: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await postTaskToWorker(makeWorker(), "Process this task", {
      foo: "bar",
    });

    expect(result.success).toBe(true);
    expect(result.endpoint).toBe("/api/task");
    expect(result.result).toEqual({ success: true, result: { handled: true } });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall[0]).toBe("https://worker.example/task");
    expect(firstCall[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer bas-token",
          "X-BAS-API-Key": "bas-token",
          "X-CEAN-API-Key": "cean-token",
        }),
      }),
    );
  });

  it("preserves plain text responses when a worker returns non-JSON content", async () => {
    vi.stubEnv("CF_BAS_API_TOKEN", "bas-token");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("plain text reply", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    const result = await postTaskToWorker(makeWorker(), "Process this task", {});

    expect(result.success).toBe(true);
    expect(result.endpoint).toBe("/task");
    expect(result.result).toBe("plain text reply");
  });

  it("returns a failure result after all worker endpoints fail", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await postTaskToWorker(makeWorker(), "Process this task", {});

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network down/i);
  });
});
