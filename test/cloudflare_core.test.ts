import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../bas-cloudflare-orchestrator/src/index.js";

// Mock @cloudflare/ai
const aiRunMock = vi.fn().mockResolvedValue({ response: "mocked ai response" });
vi.mock("@cloudflare/ai", () => {
  return {
    Ai: vi.fn().mockImplementation(() => {
      return {
        run: aiRunMock
      };
    })
  };
});

type StatementResult<T> = {
  first: () => Promise<T | null>;
  all: () => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

class FakeD1Database {
  public queries: string[] = [];
  public results = new Map<string, any>();

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    const self = this;
    return {
      bind(...params: unknown[]): StatementResult<any> {
        return {
          async first() {
            self.queries.push(normalized);
            const data = self.results.get(normalized);
            return Array.isArray(data) ? data[0] : (data || null);
          },
          async all() {
            self.queries.push(normalized);
            return { results: self.results.get(normalized) || [] };
          },
          async run() {
            self.queries.push(normalized);
            return { success: true };
          }
        };
      },
      async all() {
        self.queries.push(normalized);
        return { results: self.results.get(normalized) || [] };
      },
      async run() {
        self.queries.push(normalized);
        return { success: true };
      }
    };
  }
}

function createEnv() {
  return {
    AI: { run: aiRunMock },
    D1_METADATA: new FakeD1Database(),
    FAST_MODEL: "@cf/meta/llama-3.1-8b-instruct",
    CLOUDFLARE_API_TOKEN: "top-secret",
    BAS_API_KEY: "bas-secret",
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
    SWARM_COORDINATOR: {
        idFromName: () => "global",
        get: () => ({ fetch: async () => new Response("swarm") }),
    },
    TASK_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
    },
    BAS_ANALYTICS: {
        writeDataPoint: vi.fn()
    }
  };
}

describe("Cloudflare Orchestrator Core Endpoints", () => {
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createEnv();
  });

  describe("Authentication", () => {
    it("rejects unauthorized requests to core endpoints", async () => {
      const endpoints = [
        { path: "/ai/generate", method: "POST" },
        { path: "/kkv/clients", method: "GET" },
        { path: "/kkv/clients", method: "POST" },
        { path: "/kkv/invoices", method: "GET" },
        { path: "/kkv/invoices", method: "POST" },
      ];

      for (const ep of endpoints) {
        const res = await worker.fetch(
          new Request(`https://worker.bas${ep.path}`, { method: ep.method }),
          env
        );
        expect(res.status, `Endpoint ${ep.method} ${ep.path} should be protected`).toBe(401);
      }
    });

    it("accepts valid token for core endpoints", async () => {
      const res = await worker.fetch(
        new Request("https://worker.bas/kkv/clients", {
          headers: { "X-BAS-API-Key": "bas-secret" }
        }),
        env
      );
      expect(res.status).toBe(200);
    });
  });

  describe("/ai/generate", () => {
    it("generates content via AI proxy", async () => {
      const body = { prompt: "Hello AI", model: "@cf/meta/llama-3.1-8b" };
      const res = await worker.fetch(
        new Request("https://worker.bas/ai/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BAS-API-Key": "bas-secret"
          },
          body: JSON.stringify(body)
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.model).toBe(body.model);
      expect(data.result).toEqual({ response: "mocked ai response" });
      expect(aiRunMock).toHaveBeenCalledWith(body.model, expect.objectContaining({ prompt: "Hello AI" }));
    });

    it("uses default model if not provided", async () => {
      const res = await worker.fetch(
        new Request("https://worker.bas/ai/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BAS-API-Key": "bas-secret"
          },
          body: JSON.stringify({ prompt: "Hello" })
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.model).toBe(env.FAST_MODEL);
    });

    it("returns 400 if prompt is missing", async () => {
      const res = await worker.fetch(
        new Request("https://worker.bas/ai/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BAS-API-Key": "bas-secret"
          },
          body: JSON.stringify({})
        }),
        env
      );

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error).toMatch(/prompt is required/i);
    });

    it("returns 500 if AI run fails", async () => {
      aiRunMock.mockRejectedValueOnce(new Error("AI failure"));
      
      const res = await worker.fetch(
        new Request("https://worker.bas/ai/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BAS-API-Key": "bas-secret"
          },
          body: JSON.stringify({ prompt: "Fail me" })
        }),
        env
      );

      expect(res.status).toBe(500);
      const data = await res.json() as any;
      expect(data.error).toBe("AI failure");
    });
  });

  describe("/dispatch-smart", () => {
    it("delegates LLM work to the Cloudflare AI gateway", async () => {
      const body = {
        requestId: "req-smart-1",
        taskMeta: {
          type: "chat",
          agentName: "Paion Chat",
          involvesLLM: true,
        },
        payload: {
          prompt: "Summarize the project",
          model: "@cf/meta/llama-3.1-8b-instruct",
        },
      };

      const res = await worker.fetch(
        new Request("https://worker.bas/dispatch-smart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BAS-API-Key": "bas-secret"
          },
          body: JSON.stringify(body)
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.decision.target).toBe("cf_ai_gateway");
      expect(data.result).toEqual({ response: "mocked ai response" });
      expect(aiRunMock).toHaveBeenCalledWith(
        body.payload.model,
        expect.objectContaining({ prompt: body.payload.prompt })
      );
    });
  });

  describe("/kkv/clients", () => {
    it("GET lists clients from D1", async () => {
      const mockClients = [{ id: "1", name: "Client A" }];
      env.D1_METADATA.results.set("SELECT * FROM clients ORDER BY name ASC", mockClients);

      const res = await worker.fetch(
        new Request("https://worker.bas/kkv/clients", {
          headers: { "X-BAS-API-Key": "bas-secret" }
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockClients);
    });

    it("POST creates a new client", async () => {
      const body = { name: "New Client", email: "test@example.com" };
      const res = await worker.fetch(
        new Request("https://worker.bas/kkv/clients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BAS-API-Key": "bas-secret"
          },
          body: JSON.stringify(body)
        }),
        env
      );

      expect(res.status).toBe(201);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
      expect(env.D1_METADATA.queries).toContain("INSERT INTO clients (id, name, tax_number, email, address) VALUES (?, ?, ?, ?, ?)");
    });
  });

  describe("/kkv/invoices", () => {
    it("GET lists invoices from D1", async () => {
      const mockInvoices = [{ id: "inv1", amount: 100 }];
      env.D1_METADATA.results.set("SELECT * FROM invoices ORDER BY created_at DESC", mockInvoices);

      const res = await worker.fetch(
        new Request("https://worker.bas/kkv/invoices", {
          headers: { "X-BAS-API-Key": "bas-secret" }
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockInvoices);
    });

    it("POST creates a new invoice", async () => {
      const body = { client_id: "1", amount: 5000, currency: "EUR" };
      const res = await worker.fetch(
        new Request("https://worker.bas/kkv/invoices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BAS-API-Key": "bas-secret"
          },
          body: JSON.stringify(body)
        }),
        env
      );

      expect(res.status).toBe(201);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
      expect(env.D1_METADATA.queries).toContain("INSERT INTO invoices (id, client_id, invoice_number, amount, currency, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
    });
  });
});
