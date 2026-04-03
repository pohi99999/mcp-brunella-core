import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify as verifySignature,
} from 'crypto';

export type FederationSignatureFormat = 'hex' | 'base64' | 'base64url';

export interface FederationPublicKeyInfo {
  normalizedPublicKey: string;
  publicKeyFingerprint: string;
  keyAlgorithm: string;
}

export interface FederationPeerProofChallenge {
  challengeId: string;
  challenge: string;
  payload: string;
  issuedAt: string;
  expiresAt: string;
  publicKeyFingerprint: string;
  keyAlgorithm: string;
  status: 'pending' | 'verified' | 'expired';
  verifiedAt?: string;
}

export interface FederationPeerProofVerificationResult {
  valid: boolean;
  reason?: string;
  signatureFormat?: FederationSignatureFormat;
  publicKeyFingerprint: string;
  keyAlgorithm: string;
}

const DEFAULT_CHALLENGE_TTL_MS = 10 * 60_000;

function normalizePublicKey(publicKey: string): string {
  return publicKey.trim().replace(/\r\n/g, '\n');
}

function buildProofPayload(input: {
  challengeId: string;
  peerId: string;
  endpoint: string;
  publicKeyFingerprint: string;
  issuedAt: string;
  expiresAt: string;
  challenge: string;
}): string {
  return [
    'BRUNELLA-FEDERATION-PEER-PROOF',
    `challengeId:${input.challengeId}`,
    `peerId:${input.peerId}`,
    `endpoint:${input.endpoint}`,
    `publicKeyFingerprint:${input.publicKeyFingerprint}`,
    `issuedAt:${input.issuedAt}`,
    `expiresAt:${input.expiresAt}`,
    `challenge:${input.challenge}`,
  ].join('\n');
}

function decodeSignature(signature: string): {
  buffer: Buffer;
  format: FederationSignatureFormat;
} {
  const trimmed = signature.trim();
  if (!trimmed) {
    throw new Error('Federation proof signature missing.');
  }

  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return {
      buffer: Buffer.from(trimmed, 'hex'),
      format: 'hex',
    };
  }

  try {
    const base64UrlBuffer = Buffer.from(trimmed, 'base64url');
    if (base64UrlBuffer.length > 0) {
      return {
        buffer: base64UrlBuffer,
        format: 'base64url',
      };
    }
  } catch {
    // Continue to base64 decoding.
  }

  try {
    const base64Buffer = Buffer.from(trimmed, 'base64');
    if (base64Buffer.length > 0) {
      return {
        buffer: base64Buffer,
        format: 'base64',
      };
    }
  } catch {
    // Fall through to final error.
  }

  throw new Error('Federation proof signature must be hex or base64/base64url.');
}

export function inspectFederationPublicKey(publicKey: string): FederationPublicKeyInfo {
  const normalizedPublicKey = normalizePublicKey(publicKey);
  if (!normalizedPublicKey.includes('BEGIN PUBLIC KEY')) {
    throw new Error('publicKey PEM formátumban kötelező (-----BEGIN PUBLIC KEY-----).');
  }

  let keyObject;
  try {
    keyObject = createPublicKey(normalizedPublicKey);
  } catch (error: unknown) {
    throw new Error(
      `Érvénytelen federation publicKey: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const exported = keyObject.export({ type: 'spki', format: 'der' });
  const publicKeyFingerprint = createHash('sha256').update(exported).digest('hex');

  return {
    normalizedPublicKey,
    publicKeyFingerprint,
    keyAlgorithm: keyObject.asymmetricKeyType ?? 'unknown',
  };
}

export function createFederationPeerProofChallenge(input: {
  peerId: string;
  endpoint: string;
  publicKey: string;
  ttlMs?: number;
}): FederationPeerProofChallenge {
  const keyInfo = inspectFederationPublicKey(input.publicKey);
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_CHALLENGE_TTL_MS)).toISOString();
  const challengeId = randomUUID();
  const challenge = randomBytes(32).toString('base64url');

  return {
    challengeId,
    challenge,
    payload: buildProofPayload({
      challengeId,
      peerId: input.peerId,
      endpoint: input.endpoint,
      publicKeyFingerprint: keyInfo.publicKeyFingerprint,
      issuedAt,
      expiresAt,
      challenge,
    }),
    issuedAt,
    expiresAt,
    publicKeyFingerprint: keyInfo.publicKeyFingerprint,
    keyAlgorithm: keyInfo.keyAlgorithm,
    status: 'pending',
  };
}

export function isFederationPeerProofChallengeExpired(
  challenge: Pick<FederationPeerProofChallenge, 'expiresAt'>,
): boolean {
  return Date.parse(challenge.expiresAt) <= Date.now();
}

export function verifyFederationPeerProof(input: {
  publicKey: string;
  payload: string;
  signature: string;
}): FederationPeerProofVerificationResult {
  const keyInfo = inspectFederationPublicKey(input.publicKey);
  const { buffer, format } = decodeSignature(input.signature);
  const keyObject = createPublicKey(keyInfo.normalizedPublicKey);
  const algorithm =
    keyObject.asymmetricKeyType === 'ed25519' || keyObject.asymmetricKeyType === 'ed448'
      ? null
      : 'sha256';

  let proofValid: boolean;
  try {
    proofValid = verifySignature(
      algorithm,
      Buffer.from(input.payload, 'utf-8'),
      keyObject,
      buffer,
    );
  } catch (error: unknown) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : String(error),
      publicKeyFingerprint: keyInfo.publicKeyFingerprint,
      keyAlgorithm: keyInfo.keyAlgorithm,
    };
  }

  return {
    valid: proofValid,
    reason: proofValid ? undefined : 'Invalid federation proof signature',
    signatureFormat: format,
    publicKeyFingerprint: keyInfo.publicKeyFingerprint,
    keyAlgorithm: keyInfo.keyAlgorithm,
  };
}
