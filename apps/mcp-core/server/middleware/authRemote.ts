/**
 * authRemote — Express Middleware for Remote Layer Authentication
 * Phase 2: Discovery, Capability & Auth
 *
 * Validates the Authorization header (Bearer token) for /api/remote/* routes.
 * Attaches verified claims to req for downstream handlers.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyRemoteToken, type TokenClaims } from '@packages/core-logic/remoteAuth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      remoteUser?: TokenClaims;
    }
  }
}

/**
 * Express middleware that rejects requests without a valid remote Bearer token.
 */
export function authRemote(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const result = verifyRemoteToken(token);

  if (!result.valid) {
    res.status(401).json({ error: `Unauthorized: ${result.reason}` });
    return;
  }

  req.remoteUser = result.claims;
  next();
}
