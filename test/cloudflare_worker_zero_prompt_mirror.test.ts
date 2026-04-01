import { beforeEach, describe, expect, it } from "vitest";
import worker from "../bas-cloudflare-orchestrator/src/index.js";

type StatementResult<T> = {
  first: () => Promise<T | null>;
  all: () => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

class FakeD1Database {
  private mirror = new Map<string, { summary_json: string; mirrored_at: string }>();

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    const mirror = this.mirror;

    return {
      bind(...params: unknown[]): StatementResult<any> {
        return {
          async first() {
            if (normalized.startsWith("SELECT key, summary_json, mirrored_at FROM edge_runtime_mirror")) {
              const key = String(params[0]);
              const row = mirror.get(key);
              return row
                ? {
                    key,
                    summary_json: row.summary_json,
                    mirrored_at: row.mirrored_at,
                  }
                : null;
            }
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            if (normalized.startsWith("INSERT INTO edge_runtime_mirror")) {
              mirror.set(String(params[0]), {
                summary_json: String(params[1]),
                mirrored_at: String(params[2]),
              });
            }
            return {};
          },
        };
      },
      async run() {
        return {};
      },
    };
  }
}

function createEnv() {
  return {
    AI: {},
    D1_METADATA: new FakeD1Database(),
    BAS_TASKS: {} as KVNamespace,
    R2_KNOWLEDGE: {} as R2Bucket,
    SWARM_COORDINATOR: {
      idFromName: () => "global",
      get: () => ({ fetch: async () => new Response("swarm") }),
    } as unknown as DurableObjectNamespace,
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
    TASK_QUEUE: {} as Queue<any>,
    RESULT_QUEUE: {} as Queue<any>,
    DLQ: {} as Queue<any>,
    VECTORIZE_MEMORY: {} as VectorizeIndex,
    VECTORIZE_CEAN: {} as VectorizeIndex,
    BAS_ANALYTICS: {} as AnalyticsEngineDataset,
    DEFAULT_CODE_MODEL: "model-a",
    FALLBACK_CODE_MODEL: "model-b",
    REASONING_MODEL: "model-c",
    FAST_MODEL: "model-d",
    R2_PREFIX: "Brunella-core",
    CLOUDFLARE_API_TOKEN: "top-secret",
    CEAN_API_KEY: "cean-secret",
    EDGE_ALLOWED_ORIGINS: "",
    CORS_ORIGINS: "",
  };
}

describe("Cloudflare worker Zero-Prompt mirror route", () => {
  let env: ReturnType<typeof createEnv>;

  beforeEach(() => {
    env = createEnv();
  });

  it("stores and returns Zero-Prompt mirrored summary", async () => {
    const postRequest = new Request("https://worker.example.com/zero-prompt/summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer top-secret",
      },
      body: JSON.stringify({
        mirroredAt: "2026-04-01T11:00:00.000Z",
          summary: {
            approvals: { total: 1, pending: 1, approved: 0, rejected: 0, expired: 0, counts: { pending: 1, approved: 0, rejected: 0, expired: 0 } },
            remediation: {
            total: 1,
            counts: { awaiting_final_approval: 1 },
            active: true,
            latestUpdatedAt: "2026-04-01T10:58:00.000Z",
            pendingFinalApproval: 1,
            inFlight: 1,
            latestRunId: "run-1",
              latestRunStatus: "awaiting_final_approval",
              latestRepositoryName: "pohi99999/mcp-brunella-core",
            },
            learningLoop: {
              remediationDerived: {
                totalCandidates: 1,
                approvedCount: 1,
                rejectedCount: 0,
                pendingReview: 0,
                avgQuality: 0.95,
              },
              latestSnapshot: {
                snapshotId: "snapshot-1",
                sampleCount: 1,
                avgQuality: 0.95,
                sourceFilter: "github_remediation_runtime",
                minQuality: 0.85,
                createdAt: "2026-04-01T10:50:00.000Z",
              },
              latestTraining: {
                runId: "training-1",
                snapshotId: "snapshot-1",
                status: "completed",
                modelName: "gpt-5-mini",
                dryRun: false,
                sampleCount: 1,
                avgQuality: 0.95,
                startedAt: "2026-04-01T10:55:00.000Z",
                completedAt: "2026-04-01T10:59:00.000Z",
                snapshotSource: "github_remediation_runtime",
                minQuality: 0.85,
                routineCategories: ["code_gen", "debug"],
              },
            },
            timestamp: "2026-04-01T11:00:00.000Z",
            source: "local-runtime",
          },
      }),
    });

    const postResponse = await worker.fetch(postRequest, env as any);
    expect(postResponse.status).toBe(200);

    const getRequest = new Request("https://worker.example.com/zero-prompt/summary", {
      method: "GET",
      headers: {
        Authorization: "Bearer top-secret",
      },
    });

    const getResponse = await worker.fetch(getRequest, env as any);
    expect(getResponse.status).toBe(200);

    const payload = await getResponse.json() as {
      success: boolean;
      mirroredAt: string;
      summary: { approvals: { pending: number } };
    };
    expect(payload.success).toBe(true);
    expect(payload.mirroredAt).toBe("2026-04-01T11:00:00.000Z");
    expect(payload.summary.approvals.pending).toBe(1);
    expect((payload as { summary: { remediation: { inFlight: number } } }).summary.remediation.inFlight).toBe(1);
    expect((payload as { summary: { learningLoop: { latestTraining: { snapshotId: string; routineCategories: string[] } } } }).summary.learningLoop.latestTraining.snapshotId).toBe("snapshot-1");
    expect((payload as { summary: { learningLoop: { latestTraining: { routineCategories: string[] } } } }).summary.learningLoop.latestTraining.routineCategories).toEqual(["code_gen", "debug"]);
  });
});
