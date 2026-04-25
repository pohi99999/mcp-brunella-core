/**
 * Web middleware: CORS whitelist, rate limiting, requestId, structured request logging.
 */

import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "@packages/utils/logger.js";
import { verifyRemoteToken, type TokenClaims } from "@packages/core-logic/remoteAuth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      remoteUser?: TokenClaims;
    }
  }
}

const reqLogger = new Logger("http.log");
const DEV_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://[::1]:5173",
];

function normalizeRemoteAddress(address?: string | null): string {
  if (!address) {
    return "";
  }

  if (address.startsWith("::ffff:")) {
    return address.slice(7);
  }

  return address;
}

export function isLoopbackRequest(req: Request): boolean {
  const remoteAddress = normalizeRemoteAddress(
    req.socket.remoteAddress || req.ip || null,
  );

  return remoteAddress === "127.0.0.1" || remoteAddress === "::1";
}

function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  return authHeader.slice(7).trim();
}

export function requireOperatorAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const configuredApiKey = process.env.BRUNELLA_API_KEY?.trim();
  const bearerToken = getBearerToken(req);
  const headerApiKey =
    typeof req.headers["x-api-key"] === "string"
      ? req.headers["x-api-key"].trim()
      : undefined;

  if (configuredApiKey && (headerApiKey === configuredApiKey || bearerToken === configuredApiKey)) {
    next();
    return;
  }

  if (bearerToken) {
    const result = verifyRemoteToken(bearerToken);
    if (result.valid) {
      req.remoteUser = result.claims;
      next();
      return;
    }
  }

  if (isLoopbackRequest(req)) {
    next();
    return;
  }

  res.status(401).json({
    error:
      "Unauthorized: operator access requires loopback, BRUNELLA_API_KEY, or a valid Bearer token",
  });
}

export function getCorsOrigins() {
  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    return Array.from(new Set([...configuredOrigins, ...DEV_CORS_ORIGINS]));
  }

  return configuredOrigins;
}

function corsWhitelist(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const corsOrigins = getCorsOrigins();
  if (corsOrigins.length === 0) {
    if (process.env.NODE_ENV === "production") {
      reqLogger.structured(
        "warn",
        "CORS_ORIGINS not set in production — allowing all origins is unsafe",
        {},
      );
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string) || uuidv4();
  (req as any).id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

function requestLogging(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = (req as any).id as string;
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    reqLogger.structured("info", `${req.method} ${req.url}`, {
      requestId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs,
    });
  });
  next();
}

const apiRateLimit = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX_PER_WINDOW) || 2000,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

export {
  corsWhitelist,
  requestId,
  requestLogging,
  apiRateLimit,
};

