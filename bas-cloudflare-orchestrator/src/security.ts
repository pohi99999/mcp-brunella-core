import type { RouteAccess, WorkerAuthResult, WorkerEnv } from "./types.js";

const protectedPrefixes = [
  "/dispatch",
  "/dispatch-smart",
  "/workers",
  "/routing",
  "/zero-prompt/summary",
  "/task",
  "/task-status",
  "/status",
  "/history",
  "/queue/submit",
  "/chat/messages",
  "/artifacts",
  "/artifacts/agent",
  "/swarm/create",
  "/swarm/handoff",
  "/swarm/artifact",
  "/kkv/clients",
  "/kkv/invoices",
];

export function isProtectedWorkerPath(path: string): boolean {
  return protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function getWorkerRouteAccess(path: string, method: string): RouteAccess {
  if (path === "/health") {
    return "public";
  }
  if (isProtectedWorkerPath(path) || method.toUpperCase() === "POST" && (path.startsWith("/ai/") || path.startsWith("/task"))) {
    return "protected";
  }
  return "public";
}

export function getAllowedOrigins(env: Partial<WorkerEnv>): string[] {
  const raw = [env.EDGE_ALLOWED_ORIGINS, env.CORS_ORIGINS].filter(Boolean).join(",");
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function buildCorsHeaders(request: Request, env: Partial<WorkerEnv>): Record<string, string> {
  const allowedOrigins = getAllowedOrigins(env);
  const origin = request.headers.get("Origin") ?? "";
  const reflectedOrigin = allowedOrigins.length === 0 || allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": reflectedOrigin || "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-BAS-API-Key, X-CEAN-API-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function readToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("X-BAS-API-Key")?.trim() || request.headers.get("X-CEAN-API-Key")?.trim() || null;
}

export function authenticateWorkerRequest(request: Request, env: Partial<WorkerEnv>): WorkerAuthResult {
  const path = new URL(request.url).pathname;
  if (!isProtectedWorkerPath(path) && !path.startsWith("/ai/")) {
    return { ok: true };
  }

  const configuredTokens = [
    env.CLOUDFLARE_API_TOKEN?.trim(),
    env.BAS_API_KEY?.trim(),
    env.CEAN_API_KEY?.trim(),
  ].filter((token): token is string => Boolean(token && token.length > 0));

  if (configuredTokens.length === 0) {
    return {
      ok: false,
      status: 503,
      error: "Worker auth is required but no worker API token is configured",
    };
  }

  const providedToken = readToken(request);
  if (providedToken && configuredTokens.includes(providedToken)) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error: "Unauthorized",
  };
}
