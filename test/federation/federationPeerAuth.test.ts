import { afterEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import {
  getLocalFederationKeyIds,
  signFederationRequest,
  verifyFederationRequest,
} from '../../src/security/federationPeerAuth.js';
import { inspectFederationPublicKey } from '../../src/security/federationPeerProof.js';

describe('federationPeerAuth', () => {
  const localKeyPair = generateKeyPairSync('ed25519');
  const remoteKeyPair = generateKeyPairSync('ed25519');
  const nextLocalKeyPair = generateKeyPairSync('ed25519');
  const localPrivateKeyPem = localKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const localPublicKeyPem = localKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const nextLocalPublicKeyPem = nextLocalKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remotePrivateKeyPem = remoteKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const remotePublicKeyPem = remoteKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remoteFingerprint = inspectFederationPublicKey(remotePublicKeyPem).publicKeyFingerprint;
  const nextLocalFingerprint = inspectFederationPublicKey(nextLocalPublicKeyPem).publicKeyFingerprint;

  afterEach(() => {
    delete process.env.FEDERATION_LOCAL_PRIVATE_KEY;
    delete process.env.FEDERATION_LOCAL_PUBLIC_KEY;
    delete process.env.FEDERATION_LOCAL_NEXT_PUBLIC_KEY;
    delete process.env.FEDERATION_LOCAL_NEXT_KEY_ID;
    delete process.env.FEDERATION_AUTH_ALLOW_LEGACY_HMAC;
  });

  it('verifies asymmetric runtime federation signatures bound to both peer fingerprints', () => {
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;
    process.env.FEDERATION_AUTH_ALLOW_LEGACY_HMAC = 'false';

    const headers = signFederationRequest({
      peerId: 'peer-remote',
      privateKey: remotePrivateKeyPem,
      publicKey: remotePublicKeyPem,
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      targetPeerPublicKey: localPublicKeyPem,
    });

    const verification = verifyFederationRequest({
      peerId: headers['x-federation-peer-id'],
      keyId: headers['x-federation-key-id'],
      targetKeyId: headers['x-federation-target-key-id'],
      signatureScheme: headers['x-federation-signature-scheme'],
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      timestamp: headers['x-federation-timestamp'],
      nonce: headers['x-federation-nonce'],
      requestId: headers['x-federation-request-id'],
      bodySha256: headers['x-federation-body-sha256'],
      signature: headers['x-federation-signature'],
      expectedPublicKey: remotePublicKeyPem,
      expectedKeyId: remoteFingerprint,
      localKeyIds: getLocalFederationKeyIds(),
      allowedSignatureSchemes: ['asymmetric-v1'],
    });

    expect(verification.valid).toBe(true);
    expect(verification.signatureScheme).toBe('asymmetric-v1');
    expect(verification.keyId).toBe(remoteFingerprint);
  });

  it('rejects asymmetric runtime federation signatures when the target fingerprint does not match the local key', () => {
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;
    process.env.FEDERATION_AUTH_ALLOW_LEGACY_HMAC = 'false';

    const wrongTargetKeyPair = generateKeyPairSync('ed25519');
    const wrongTargetPublicKeyPem = wrongTargetKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const headers = signFederationRequest({
      peerId: 'peer-remote',
      privateKey: remotePrivateKeyPem,
      publicKey: remotePublicKeyPem,
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      targetPeerPublicKey: wrongTargetPublicKeyPem,
    });

    const verification = verifyFederationRequest({
      peerId: headers['x-federation-peer-id'],
      keyId: headers['x-federation-key-id'],
      targetKeyId: headers['x-federation-target-key-id'],
      signatureScheme: headers['x-federation-signature-scheme'],
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      timestamp: headers['x-federation-timestamp'],
      nonce: headers['x-federation-nonce'],
      requestId: headers['x-federation-request-id'],
      bodySha256: headers['x-federation-body-sha256'],
      signature: headers['x-federation-signature'],
      expectedPublicKey: remotePublicKeyPem,
      expectedKeyId: remoteFingerprint,
      localKeyIds: getLocalFederationKeyIds(),
      allowedSignatureSchemes: ['asymmetric-v1'],
    });

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('target key binding mismatch');
  });

  it('rejects federation requests when the signature scheme header is missing', () => {
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;

    const headers = signFederationRequest({
      peerId: 'peer-remote',
      privateKey: remotePrivateKeyPem,
      publicKey: remotePublicKeyPem,
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      targetPeerPublicKey: localPublicKeyPem,
    });

    const verification = verifyFederationRequest({
      peerId: headers['x-federation-peer-id'],
      keyId: headers['x-federation-key-id'],
      targetKeyId: headers['x-federation-target-key-id'],
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      timestamp: headers['x-federation-timestamp'],
      nonce: headers['x-federation-nonce'],
      requestId: headers['x-federation-request-id'],
      bodySha256: headers['x-federation-body-sha256'],
      signature: headers['x-federation-signature'],
      expectedPublicKey: remotePublicKeyPem,
      expectedKeyId: remoteFingerprint,
      localKeyIds: getLocalFederationKeyIds(),
      allowedSignatureSchemes: ['asymmetric-v1'],
    });

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('signature scheme missing');
  });

  it('accepts federation requests targeting the configured next local key id', () => {
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;
    process.env.FEDERATION_LOCAL_NEXT_PUBLIC_KEY = nextLocalPublicKeyPem;

    const headers = signFederationRequest({
      peerId: 'peer-remote',
      privateKey: remotePrivateKeyPem,
      publicKey: remotePublicKeyPem,
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      targetPeerPublicKey: nextLocalPublicKeyPem,
    });

    const verification = verifyFederationRequest({
      peerId: headers['x-federation-peer-id'],
      keyId: headers['x-federation-key-id'],
      targetKeyId: headers['x-federation-target-key-id'],
      signatureScheme: headers['x-federation-signature-scheme'],
      method: 'POST',
      path: '/api/v1/federation/execute',
      body: { capabilityName: 'agent_list' },
      timestamp: headers['x-federation-timestamp'],
      nonce: headers['x-federation-nonce'],
      requestId: headers['x-federation-request-id'],
      bodySha256: headers['x-federation-body-sha256'],
      signature: headers['x-federation-signature'],
      expectedPublicKey: remotePublicKeyPem,
      expectedKeyId: remoteFingerprint,
      localKeyIds: getLocalFederationKeyIds(),
      allowedSignatureSchemes: ['asymmetric-v1'],
    });

    expect(verification.valid).toBe(true);
    expect(verification.targetKeyId).toBe(nextLocalFingerprint);
  });

  it('does not implicitly downgrade to legacy hmac signing in test mode', () => {
    expect(() =>
      signFederationRequest({
        peerId: 'peer-remote',
        method: 'POST',
        path: '/api/v1/federation/execute',
        body: { capabilityName: 'agent_list' },
      }),
    ).toThrow(/Legacy HMAC fallback is disabled/);
  });
});
