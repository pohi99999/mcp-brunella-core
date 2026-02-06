/**
 * Web middleware: CORS whitelist, rate limiting, requestId, structured request logging.
 */

import type { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';

const reqLogger = new Logger('http.log');

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsWhitelist(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (corsOrigins.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  (req as any).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

function requestLogging(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = (req as any).id as string;
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    reqLogger.structured('info', `${req.method} ${req.url}`, {
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
  max: Number(process.env.RATE_LIMIT_MAX_PER_WINDOW) || 120,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

export { corsWhitelist, requestId, requestLogging, apiRateLimit };
