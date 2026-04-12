import type { NextFunction, Request, Response } from 'express';

import { federationReplayGuard } from '../../core/federation/federationReplayGuard.js';
import { trustRegistry } from '../../core/federation/trustRegistry.js';
import {
  FEDERATION_AUTH_HEADER,
  getLocalFederationKeyId,
  getLocalFederationKeyIds,
  verifyFederationRequest,
} from '../../security/federationPeerAuth.js';
import { authRemote } from './authRemote.js';
import { ensureError } from '../../utils/ensureError.js';
import { logDebug } from '../../utils/logger.js';

interface FederationPeerRequestContext {
  peerId: string;
  keyId?: string;
  targetKeyId?: string;
  signatureScheme?: string;
  requestId: string;
  nonce: string;
  timestamp: string;
}



function normalizeRemoteAddress(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.startsWith('::ffff:') ? value.slice('::ffff:'.length) : value;
}

function isLoopbackAddress(address: string | undefined): boolean {
  const normalized = normalizeRemoteAddress(address);
  return normalized === '127.0.0.1' || normalized === '::1';
}

function getCanonicalRequestPath(req: any): string {
  return req.originalUrl.split('?')[0] || req.originalUrl || req.path;
}

function getCanonicalRequestBody(req: any): unknown {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }

  return req.body;
}

export function allowLoopbackWithoutAuth(req: any, _res: any, next: any): void {
  if (isLoopbackAddress(req.socket.remoteAddress)) {
    next();
    return;
  }

  authRemote(req, _res, next);
}

export function isHttpsEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    return parsed.protocol === 'https:';
  } catch (error: unknown) {
    const err = ensureError(error);
    logDebug('FederationAuth', `Invalid HTTPS endpoint ${endpoint}: ${err.message}`);
    return false;
  }
}

export function authFederationPeer(req: any, res: any, next: any): void {
  const peerId = req.header(FEDERATION_AUTH_HEADER.peerId);
  const keyId = req.header(FEDERATION_AUTH_HEADER.keyId) ?? undefined;
  const targetKeyId = req.header(FEDERATION_AUTH_HEADER.targetKeyId) ?? undefined;
  const signatureScheme = req.header(FEDERATION_AUTH_HEADER.signatureScheme) ?? undefined;
  const timestamp = req.header(FEDERATION_AUTH_HEADER.timestamp);
  const nonce = req.header(FEDERATION_AUTH_HEADER.nonce);
  const requestId = req.header(FEDERATION_AUTH_HEADER.requestId);
  const bodySha256 = req.header(FEDERATION_AUTH_HEADER.bodySha256);
  const signature = req.header(FEDERATION_AUTH_HEADER.signature);

  if (!peerId || !timestamp || !nonce || !requestId || !bodySha256 || !signature) {
    res.status(401).json({ error: 'Unauthorized: missing federation signature headers' });
    return;
  }

  const trustedPeer = trustRegistry.getPeer(peerId);
  const trustedPeerKeyId = trustRegistry.getPeerRuntimeKeyId(peerId);
  const trustedPeerKeys = trustRegistry.getPeerRuntimeKeys(peerId);
  const localKeyIds = getLocalFederationKeyIds();

  const verification = verifyFederationRequest({
    peerId,
    keyId,
    targetKeyId,
    signatureScheme,
    method: req.method,
    path: getCanonicalRequestPath(req),
    body: getCanonicalRequestBody(req),
    timestamp,
    nonce,
    requestId,
    bodySha256,
    signature,
    expectedPublicKey: trustedPeer?.publicKey,
    expectedKeyId: trustedPeerKeyId,
    expectedPeerKeys: trustedPeerKeys,
    localKeyId: getLocalFederationKeyId(),
    localKeyIds,
    allowedSignatureSchemes: ['asymmetric-v1'],
  });

  if (!verification.valid) {
    res.status(401).json({ error: `Unauthorized: ${verification.reason}` });
    return;
  }

  if (!federationReplayGuard.consume(peerId, nonce, requestId)) {
    res.status(409).json({ error: 'Federation replay detected' });
    return;
  }

  const trustState = trustRegistry.checkTrust(peerId);
  if (trustState !== 'trusted') {
    res.status(403).json({ error: `Forbidden: federation peer is not trusted (${trustState})` });
    return;
  }

  (req as any).federationPeer = {
    peerId,
    keyId: verification.keyId,
    targetKeyId: verification.targetKeyId,
    signatureScheme: verification.signatureScheme,
    requestId,
    nonce,
    timestamp,
  };
  next();
}

export function allowLoopbackOrSignedFederationPeer(req: any, res: any, next: any): void {
  if (isLoopbackAddress(req.socket.remoteAddress)) {
    next();
    return;
  }

  authFederationPeer(req, res, next);
}
