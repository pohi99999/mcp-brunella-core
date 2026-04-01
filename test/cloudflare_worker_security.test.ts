import { describe, expect, it } from "vitest";
import {
  authenticateWorkerRequest,
  buildCorsHeaders,
  getWorkerRouteAccess,
  getAllowedOrigins,
  isProtectedWorkerPath,
} from "../bas-cloudflare-orchestrator/src/security.js";

describe("Cloudflare worker security helpers", () => {
  it("should recognize protected worker paths", () => {
    expect(isProtectedWorkerPath("/chat/messages")).toBe(true);
    expect(isProtectedWorkerPath("/queue/submit")).toBe(true);
    expect(isProtectedWorkerPath("/artifacts/agent")).toBe(true);
    expect(isProtectedWorkerPath("/swarm/create")).toBe(true);
    expect(isProtectedWorkerPath("/")).toBe(false);
    expect(isProtectedWorkerPath("/health")).toBe(false);
  });

  it("should expose explicit route access policy for worker paths", () => {
    expect(getWorkerRouteAccess("/health", "GET")).toBe("public");
    expect(getWorkerRouteAccess("/zero-prompt/summary", "GET")).toBe("protected");
    expect(getWorkerRouteAccess("/task", "POST")).toBe("protected");
    expect(getWorkerRouteAccess("/status/task-1", "GET")).toBe("protected");
    expect(getWorkerRouteAccess("/history", "GET")).toBe("protected");
    expect(getWorkerRouteAccess("/queue/submit", "POST")).toBe("protected");
    expect(getWorkerRouteAccess("/chat/messages", "GET")).toBe("protected");
    expect(getWorkerRouteAccess("/unknown/path", "GET")).toBe("public");
  });

  it("should parse allowed origins from env", () => {
    expect(
      getAllowedOrigins({
        EDGE_ALLOWED_ORIGINS:
          "https://dashboard.example.com, http://localhost:5173 ",
      }),
    ).toEqual([
      "https://dashboard.example.com",
      "http://localhost:5173",
    ]);
  });

  it("should reflect only allowed origins in CORS headers", () => {
    const request = new Request("https://worker.example.com/chat/messages", {
      headers: {
        Origin: "https://dashboard.example.com",
      },
    });

    const headers = buildCorsHeaders(request, {
      EDGE_ALLOWED_ORIGINS: "https://dashboard.example.com",
    });

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://dashboard.example.com",
    );
    expect(headers["Access-Control-Allow-Headers"]).toContain("X-BAS-API-Key");
  });

  it("should fail closed when protected routes have no configured token", () => {
    const request = new Request("https://worker.example.com/chat/messages");

    expect(authenticateWorkerRequest(request, {})).toEqual({
      ok: false,
      status: 503,
      error:
        "Worker auth is required but no worker API token is configured",
    });
  });

  it("should accept protected routes with bearer token or BAS header", () => {
    const bearerRequest = new Request(
      "https://worker.example.com/chat/messages",
      {
        headers: {
          Authorization: "Bearer top-secret",
        },
      },
    );
    const basHeaderRequest = new Request(
      "https://worker.example.com/queue/submit",
      {
        headers: {
          "X-BAS-API-Key": "top-secret",
        },
      },
    );

    expect(
      authenticateWorkerRequest(bearerRequest, {
        CLOUDFLARE_API_TOKEN: "top-secret",
      }),
    ).toEqual({ ok: true });
    expect(
      authenticateWorkerRequest(basHeaderRequest, {
        CLOUDFLARE_API_TOKEN: "top-secret",
      }),
    ).toEqual({ ok: true });
  });

  it("should accept CEAN API key as an alternative worker token", () => {
    const request = new Request("https://worker.example.com/chat/messages", {
      headers: {
        "X-CEAN-API-Key": "cean-secret",
      },
    });

    expect(
      authenticateWorkerRequest(request, {
        CEAN_API_KEY: "cean-secret",
      }),
    ).toEqual({ ok: true });
  });

  it("should reject wrong tokens on protected routes", () => {
    const request = new Request("https://worker.example.com/swarm/create", {
      headers: {
        Authorization: "Bearer wrong-token",
      },
    });

    expect(
      authenticateWorkerRequest(request, {
        CLOUDFLARE_API_TOKEN: "top-secret",
      }),
    ).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });
});
