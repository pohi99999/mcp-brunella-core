export interface WorkerSecurityEnv {
  CLOUDFLARE_API_TOKEN?: string;
  BAS_API_KEY?: string;
  CEAN_API_KEY?: string;
  EDGE_ALLOWED_ORIGINS?: string;
  CORS_ORIGINS?: string;
}

type RouteAccess = "public" | "protected";

type WorkerRoutePolicy = {
  path: RegExp;
  methods?: string[];
  access: RouteAccess;
};

const WORKER_ROUTE_POLICIES: WorkerRoutePolicy[] = [
  { path: /^\/$/, methods: ["GET"], access: "public" },
  { path: /^\/health$/, methods: ["GET"], access: "public" },
  { path: /^\/dispatch$/, methods: ["POST"], access: "protected" },
  { path: /^\/dispatch-smart$/, methods: ["POST"], access: "protected" },
  { path: /^\/workers$/, methods: ["GET"], access: "protected" },
  { path: /^\/routing$/, methods: ["GET"], access: "protected" },
  { path: /^\/task$/, methods: ["POST"], access: "protected" },
  { path: /^\/task-status\/[^/]+$/, methods: ["GET", "POST"], access: "protected" },
  { path: /^\/status\/[^/]+$/, methods: ["GET"], access: "protected" },
  { path: /^\/history$/, methods: ["GET"], access: "protected" },
  { path: /^\/zero-prompt\/summary$/, methods: ["GET", "POST"], access: "protected" },
  { path: /^\/queue\/submit$/, methods: ["POST"], access: "protected" },
  { path: /^\/artifacts(?:\/.*)?$/, access: "protected" },
  { path: /^\/analytics\/summary$/, methods: ["GET"], access: "protected" },
  { path: /^\/chat\/messages$/, methods: ["GET", "POST"], access: "protected" },
  { path: /^\/swarm(?:\/.*)?$/, access: "protected" },
];

function normalizeToken(value?: string): string | null {
  const trimmed = (value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getAllowedOrigins(env: WorkerSecurityEnv): string[] {
  return (env.EDGE_ALLOWED_ORIGINS || env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(
  request: Request,
  env: WorkerSecurityEnv,
): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return true;
  }

  return getAllowedOrigins(env).includes(origin);
}

export function buildCorsHeaders(
  request: Request,
  env: WorkerSecurityEnv,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-BAS-API-Key, X-CEAN-API-Key, Upgrade",
    Vary: "Origin",
  };

  const origin = request.headers.get("Origin");
  if (origin && isOriginAllowed(request, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function isProtectedWorkerPath(path: string): boolean {
  return WORKER_ROUTE_POLICIES.some(
    (policy) => policy.access === "protected" && policy.path.test(path),
  );
}

export function getWorkerRouteAccess(
  path: string,
  method = "GET",
): RouteAccess {
  const normalizedMethod = method.toUpperCase();

  for (const policy of WORKER_ROUTE_POLICIES) {
    if (!policy.path.test(path)) {
      continue;
    }

    if (
      policy.methods &&
      !policy.methods.map((candidate) => candidate.toUpperCase()).includes(normalizedMethod)
    ) {
      continue;
    }

    return policy.access;
  }

  return "public";
}

export function extractWorkerRequestToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return normalizeToken(authHeader.slice(7));
  }

  return (
    normalizeToken(request.headers.get("X-BAS-API-Key") || undefined) ||
    normalizeToken(request.headers.get("X-CEAN-API-Key") || undefined)
  );
}

export function authenticateWorkerRequest(
  request: Request,
  env: WorkerSecurityEnv,
): { ok: true } | { ok: false; status: number; error: string } {
  const { pathname } = new URL(request.url);
  if (getWorkerRouteAccess(pathname, request.method) !== "protected") {
    return { ok: true };
  }

  const acceptedTokens = [
    normalizeToken(env.CLOUDFLARE_API_TOKEN),
    normalizeToken(env.BAS_API_KEY),
    normalizeToken(env.CEAN_API_KEY),
  ].filter((token): token is string => Boolean(token));

  if (acceptedTokens.length === 0) {
    return {
      ok: false,
      status: 503,
      error:
        "Worker auth is required but no worker API token is configured",
    };
  }

  const receivedToken = extractWorkerRequestToken(request);
  if (!receivedToken || !acceptedTokens.includes(receivedToken)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
