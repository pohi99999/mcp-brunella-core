import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign as signWithPrivateKey,
  verify as verifyWithPublicKey,
} from 'crypto';
import { inspectFederationPublicKey } from './federationPeerProof.js';

export const FEDERATION_AUTH_MAX_CLOCK_SKEW_MS = 5 * 60_000;
export type FederationRuntimeSignatureScheme = 'asymmetric-v1';
export interface FederationRuntimePublicKeyBinding {
  keyId: string;
  publicKey: string;
}

export const FEDERATION_AUTH_HEADER = {
  peerId: 'x-federation-peer-id',
  keyId: 'x-federation-key-id',
  targetKeyId: 'x-federation-target-key-id',
  signatureScheme: 'x-federation-signature-scheme',
  timestamp: 'x-federation-timestamp',
  nonce: 'x-federation-nonce',
  requestId: 'x-federation-request-id',
  bodySha256: 'x-federation-body-sha256',
  signature: 'x-federation-signature',
} as const;

export interface SignedFederationRequest {
  peerId?: string;
  method: string;
  path: string;
  body?: unknown;
  privateKey?: string;
  publicKey?: string;
  keyId?: string;
  targetKeyId?: string;
  targetPeerPublicKey?: string;
  timestamp?: string;
  nonce?: string;
  requestId?: string;
}

export interface FederationRequestVerificationInput {
  peerId: string;
  method: string;
  path: string;
  body?: unknown;
  keyId?: string;
  targetKeyId?: string;
  signatureScheme?: string;
  timestamp: string;
  nonce: string;
  requestId: string;
  bodySha256: string;
  signature: string;
  expectedPublicKey?: string;
  expectedKeyId?: string;
  expectedPeerKeys?: FederationRuntimePublicKeyBinding[];
  localKeyId?: string;
  localKeyIds?: string[];
  allowedSignatureSchemes?: FederationRuntimeSignatureScheme[];
  nowMs?: number;
}

export interface FederationRequestVerificationResult {
  valid: boolean;
  reason?: string;
  peerId?: string;
  keyId?: string;
  targetKeyId?: string;
  signatureScheme?: FederationRuntimeSignatureScheme;
  timestamp?: string;
  nonce?: string;
  requestId?: string;
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizePem(pem: string): string {
  return pem.trim().replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

function serializeBody(body: unknown): string {
  if (body === undefined) {
    return '';
  }

  return JSON.stringify(body);
}

function computeBodySha256(body: unknown): string {
  return createHash('sha256').update(serializeBody(body)).digest('hex');
}

function buildSignaturePayload(input: {
  peerId: string;
  keyId: string;
  targetKeyId: string;
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  requestId: string;
  bodySha256: string;
}): string {
  return [
    'BRUNELLA-FEDERATION-REQUEST-V2',
    `peerId:${input.peerId}`,
    `keyId:${input.keyId}`,
    `targetKeyId:${input.targetKeyId}`,
    `method:${input.method.toUpperCase()}`,
    `path:${normalizePath(input.path)}`,
    `timestamp:${input.timestamp}`,
    `nonce:${input.nonce}`,
    `requestId:${input.requestId}`,
    `bodySha256:${input.bodySha256}`,
  ].join('\n');
}

function decodeSignature(signature: string): Buffer {
  const trimmed = signature.trim();
  if (!trimmed) {
    throw new Error('Federation signature missing');
  }

  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  return Buffer.from(trimmed, 'base64url');
}

function getPrivateKeyAlgorithm(privateKeyPem: string): null | 'sha256' {
  const privateKey = createPrivateKey(privateKeyPem);
  return privateKey.asymmetricKeyType === 'ed25519' || privateKey.asymmetricKeyType === 'ed448'
    ? null
    : 'sha256';
}

function signAsymmetricPayload(payload: string, privateKeyPem: string): string {
  return signWithPrivateKey(
    getPrivateKeyAlgorithm(privateKeyPem),
    Buffer.from(payload, 'utf-8'),
    createPrivateKey(privateKeyPem),
  ).toString('base64url');
}

function verifyAsymmetricPayload(payload: string, signature: string, publicKeyPem: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    const algorithm = key.asymmetricKeyType === 'ed25519' || key.asymmetricKeyType === 'ed448'
      ? null
      : 'sha256';
    return verifyWithPublicKey(
      algorithm,
      Buffer.from(payload, 'utf-8'),
      key,
      decodeSignature(signature),
    );
  } catch {
    return false;
  }
}

function normalizeSignatureScheme(signatureScheme?: string): FederationRuntimeSignatureScheme | null {
  const normalized = signatureScheme?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'asymmetric-v1') {
    return normalized;
  }

  return null;
}

function uniqueRuntimePublicKeyBindings(
  keys: FederationRuntimePublicKeyBinding[],
): FederationRuntimePublicKeyBinding[] {
  const byKeyId = new Map<string, FederationRuntimePublicKeyBinding>();
  for (const key of keys) {
    if (!key.keyId.trim() || !key.publicKey.trim()) {
      continue;
    }
    byKeyId.set(key.keyId, key);
  }

  return Array.from(byKeyId.values());
}

function resolveLocalFederationCurrentVerificationKey(): FederationRuntimePublicKeyBinding | null {
  const localSigningKey = resolveLocalFederationSigningKey();
  if (localSigningKey) {
    return {
      keyId: localSigningKey.keyId,
      publicKey: localSigningKey.publicKeyPem,
    };
  }

  const publicKeyRaw = process.env.FEDERATION_LOCAL_PUBLIC_KEY;
  if (!publicKeyRaw?.trim()) {
    return null;
  }

  const publicKeyInfo = inspectFederationPublicKey(normalizePem(publicKeyRaw));
  return {
    keyId: publicKeyInfo.publicKeyFingerprint,
    publicKey: publicKeyInfo.normalizedPublicKey,
  };
}

function resolveLocalFederationNextVerificationKey(): FederationRuntimePublicKeyBinding | null {
  const nextPublicKeyRaw = process.env.FEDERATION_LOCAL_NEXT_PUBLIC_KEY;
  if (!nextPublicKeyRaw?.trim()) {
    return null;
  }

  const nextPublicKeyInfo = inspectFederationPublicKey(normalizePem(nextPublicKeyRaw));
  return {
    keyId: process.env.FEDERATION_LOCAL_NEXT_KEY_ID?.trim() || nextPublicKeyInfo.publicKeyFingerprint,
    publicKey: nextPublicKeyInfo.normalizedPublicKey,
  };
}

function resolveExpectedPeerKeys(
  input: FederationRequestVerificationInput,
): FederationRuntimePublicKeyBinding[] {
  const keys = [...(input.expectedPeerKeys ?? [])];

  if (input.expectedPublicKey?.trim()) {
    const normalizedPublicKey = normalizePem(input.expectedPublicKey);
    const publicKeyInfo = inspectFederationPublicKey(normalizedPublicKey);
    keys.push({
      keyId: input.expectedKeyId?.trim() || publicKeyInfo.publicKeyFingerprint,
      publicKey: publicKeyInfo.normalizedPublicKey,
    });
  }

  return uniqueRuntimePublicKeyBindings(keys);
}

function resolveLocalFederationSigningKey(input?: {
  privateKey?: string;
  publicKey?: string;
  keyId?: string;
}): {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
} | null {
  const privateKeyRaw = input?.privateKey ?? process.env.FEDERATION_LOCAL_PRIVATE_KEY;
  if (!privateKeyRaw?.trim()) {
    return null;
  }

  const privateKeyPem = normalizePem(privateKeyRaw);
  const derivedPublicKeyPem = createPublicKey(createPrivateKey(privateKeyPem))
    .export({ type: 'spki', format: 'pem' })
    .toString();
  const publicKeyPem = normalizePem(input?.publicKey ?? process.env.FEDERATION_LOCAL_PUBLIC_KEY ?? derivedPublicKeyPem);
  const publicKeyInfo = inspectFederationPublicKey(publicKeyPem);

  return {
    privateKeyPem,
    publicKeyPem: publicKeyInfo.normalizedPublicKey,
    keyId: input?.keyId ?? publicKeyInfo.publicKeyFingerprint,
  };
}

export function getLocalFederationKeyId(): string | undefined {
  return getLocalFederationKeyIds()[0];
}

export function getLocalFederationKeyIds(): string[] {
  const keys = uniqueRuntimePublicKeyBindings(
    [
      resolveLocalFederationCurrentVerificationKey(),
      resolveLocalFederationNextVerificationKey(),
    ].filter((key): key is FederationRuntimePublicKeyBinding => key !== null),
  );

  return keys.map((key) => key.keyId);
}

export function getLocalFederationPeerId(explicitPeerId?: string): string {
  const resolved =
    explicitPeerId?.trim() ||
    process.env.FEDERATION_LOCAL_PEER_ID?.trim() ||
    process.env.BRUNELLA_NODE_ID?.trim() ||
    'local-bas';

  return resolved;
}

export function signFederationRequest(input: SignedFederationRequest): Record<string, string> {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const nonce = input.nonce ?? randomUUID();
  const requestId = input.requestId ?? randomUUID();
  const peerId = getLocalFederationPeerId(input.peerId);
  const bodySha256 = computeBodySha256(input.body);
  const targetKeyId =
    input.targetKeyId ??
    (input.targetPeerPublicKey ? inspectFederationPublicKey(input.targetPeerPublicKey).publicKeyFingerprint : undefined);
  const localKey = resolveLocalFederationSigningKey({
    privateKey: input.privateKey,
    publicKey: input.publicKey,
    keyId: input.keyId,
  });

  if (!localKey || !targetKeyId) {
    throw new Error(
      'Federation runtime signing requires FEDERATION_LOCAL_PRIVATE_KEY and a target peer key binding.',
    );
  }

  const payload = buildSignaturePayload({
    peerId,
    keyId: localKey.keyId,
    targetKeyId,
    method: input.method,
    path: input.path,
    timestamp,
    nonce,
    requestId,
    bodySha256,
  });
  const signature = signAsymmetricPayload(payload, localKey.privateKeyPem);

  return {
    [FEDERATION_AUTH_HEADER.peerId]: peerId,
    [FEDERATION_AUTH_HEADER.keyId]: localKey.keyId,
    [FEDERATION_AUTH_HEADER.targetKeyId]: targetKeyId,
    [FEDERATION_AUTH_HEADER.signatureScheme]: 'asymmetric-v1',
    [FEDERATION_AUTH_HEADER.timestamp]: timestamp,
    [FEDERATION_AUTH_HEADER.nonce]: nonce,
    [FEDERATION_AUTH_HEADER.requestId]: requestId,
    [FEDERATION_AUTH_HEADER.bodySha256]: bodySha256,
    [FEDERATION_AUTH_HEADER.signature]: signature,
  };
}

export function verifyFederationRequest(
  input: FederationRequestVerificationInput,
): FederationRequestVerificationResult {
  if (!input.peerId.trim()) {
    return { valid: false, reason: 'Peer ID missing' };
  }

  const timestampMs = Date.parse(input.timestamp);
  if (Number.isNaN(timestampMs)) {
    return { valid: false, reason: 'Invalid federation timestamp' };
  }

  const nowMs = input.nowMs ?? Date.now();
  if (Math.abs(nowMs - timestampMs) > FEDERATION_AUTH_MAX_CLOCK_SKEW_MS) {
    return { valid: false, reason: 'Federation request timestamp outside allowed skew window' };
  }

  const expectedBodySha256 = computeBodySha256(input.body);
  if (input.bodySha256 !== expectedBodySha256) {
    return { valid: false, reason: 'Federation body hash mismatch' };
  }

  const signatureScheme = normalizeSignatureScheme(input.signatureScheme);
  if (!signatureScheme) {
    return input.signatureScheme?.trim()
      ? { valid: false, reason: 'Unsupported federation signature scheme' }
      : { valid: false, reason: 'Federation signature scheme missing' };
  }
  if (input.allowedSignatureSchemes && !input.allowedSignatureSchemes.includes(signatureScheme)) {
    return { valid: false, reason: `Federation signature scheme ${signatureScheme} not allowed` };
  }

  const keyId = input.keyId?.trim();
  const targetKeyId = input.targetKeyId?.trim();
  const expectedPeerKeys = resolveExpectedPeerKeys(input);
  const localKeyIds = Array.from(new Set([
    ...(input.localKeyIds ?? []).map((key) => key.trim()).filter(Boolean),
    input.localKeyId?.trim(),
  ].filter((key): key is string => Boolean(key))));
  if (expectedPeerKeys.length === 0) {
    return { valid: false, reason: 'Trusted peer public key missing for federation verification' };
  }
  if (!keyId) {
    return { valid: false, reason: 'Federation key id missing' };
  }
  const matchingPeerKey = expectedPeerKeys.find((key) => key.keyId === keyId);
  if (!matchingPeerKey) {
    return { valid: false, reason: 'Federation key binding mismatch' };
  }
  if (!targetKeyId) {
    return { valid: false, reason: 'Federation target key id missing' };
  }
  if (localKeyIds.length === 0) {
    return { valid: false, reason: 'Local federation key id not configured' };
  }
  if (!localKeyIds.includes(targetKeyId)) {
    return { valid: false, reason: 'Federation target key binding mismatch' };
  }

  const payload = buildSignaturePayload({
    peerId: input.peerId,
    keyId,
    targetKeyId,
    method: input.method,
    path: input.path,
    timestamp: input.timestamp,
    nonce: input.nonce,
    requestId: input.requestId,
    bodySha256: input.bodySha256,
  });
  if (!verifyAsymmetricPayload(payload, input.signature, matchingPeerKey.publicKey)) {
    return { valid: false, reason: 'Invalid federation signature' };
  }

  return {
    valid: true,
    peerId: input.peerId,
    keyId,
    targetKeyId,
    signatureScheme,
    timestamp: input.timestamp,
    nonce: input.nonce,
    requestId: input.requestId,
  };
}
