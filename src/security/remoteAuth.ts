/**
 * Remote Auth — Token Generation & Verification
 * Phase 2: Discovery, Capability & Auth
 *
 * Provides HMAC-SHA256 signed tokens for authenticating remote layer requests.
 * Token format: base64url(<userId>.<expiresAtMs>) + "." + <hmac-hex>
 *
 * Secret is read from REMOTE_AUTH_SECRET env var (falls back to a dev default).
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { logWarn } from '../utils/logger.js';

const DEV_SECRET = 'brunella-dev-secret-do-not-use-in-production';

function getSecret(): string {
  const secret = process.env.REMOTE_AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'REMOTE_AUTH_SECRET environment variable must be set in production. Refusing to sign tokens with the dev fallback.',
      );
    }
    logWarn('RemoteAuth', 'REMOTE_AUTH_SECRET not set — using dev fallback. NEVER deploy without this variable set!');
    return DEV_SECRET;
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/**
 * Generate a signed remote access token for a given userId.
 * @param userId  The user identifier to embed in the token.
 * @param ttlMs   Token time-to-live in milliseconds (default 1 hour).
 * @returns Opaque token string.
 */
export function generateRemoteToken(userId: string, ttlMs = 3_600_000): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${userId}.${expiresAt}`;
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const mac = sign(payloadB64);
  return `${payloadB64}.${mac}`;
}

export interface TokenClaims {
  userId: string;
  expiresAt: number;
}

export interface VerifyResult {
  valid: boolean;
  claims?: TokenClaims;
  reason?: string;
}

/**
 * Verify a remote access token.
 * @param token  The token string to verify.
 * @returns VerifyResult with valid flag and claims on success.
 */
export function verifyRemoteToken(token: string): VerifyResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token missing or not a string' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Malformed token structure' };
  }

  const [payloadB64, mac] = parts;

  // Verify signature using timing-safe comparison
  const expectedMac = sign(payloadB64);
  const macBuf = Buffer.from(mac, 'hex');
  const expectedBuf = Buffer.from(expectedMac, 'hex');

  if (macBuf.length !== expectedBuf.length) {
    return { valid: false, reason: 'Invalid signature' };
  }

  let sigOk: boolean;
  try {
    sigOk = timingSafeEqual(macBuf, expectedBuf);
  } catch {
    return { valid: false, reason: 'Signature comparison failed' };
  }

  if (!sigOk) {
    return { valid: false, reason: 'Invalid signature' };
  }

  // Decode payload
  let userId: string;
  let expiresAt: number;
  try {
    const decoded = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const dotIdx = decoded.lastIndexOf('.');
    if (dotIdx === -1) return { valid: false, reason: 'Malformed payload' };
    userId = decoded.slice(0, dotIdx);
    expiresAt = parseInt(decoded.slice(dotIdx + 1), 10);
  } catch {
    return { valid: false, reason: 'Failed to decode payload' };
  }

  if (isNaN(expiresAt)) {
    return { valid: false, reason: 'Invalid expiry in token' };
  }

  if (Date.now() > expiresAt) {
    return { valid: false, reason: 'Token expired' };
  }

  return { valid: true, claims: { userId, expiresAt } };
}
