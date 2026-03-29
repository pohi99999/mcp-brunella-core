import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createFederationRouter } from '../src/server/routes/federation.js';

const federationMocks = vi.hoisted(() => ({
  listPeers: vi.fn(),
  register: vi.fn(),
  revoke: vi.fn(),
  issue: vi.fn(),
  listManifestsForPeer: vi.fn(),
  verify: vi.fn(),
  listSessions: vi.fn(),
  createOffer: vi.fn(),
  accept: vi.fn(),
  reject: vi.fn(),
  execute: vi.fn(),
  getDynamicToolRegistry: vi.fn(),
  getToolRegistry: vi.fn(),
  getRegisteredToolsList: vi.fn(),
}));

vi.mock('../src/core/federation/trustRegistry.js', () => ({
  trustRegistry: {
    listPeers: federationMocks.listPeers,
    register: federationMocks.register,
    revoke: federationMocks.revoke,
  },
}));

vi.mock('../src/core/federation/capabilityManifest.js', () => ({
  capabilityManifestManager: {
    issue: federationMocks.issue,
    listManifestsForPeer: federationMocks.listManifestsForPeer,
    verify: federationMocks.verify,
  },
}));

vi.mock('../src/core/federation/negotiationProtocol.js', () => ({
  negotiationProtocol: {
    listSessions: federationMocks.listSessions,
    createOffer: federationMocks.createOffer,
    accept: federationMocks.accept,
    reject: federationMocks.reject,
  },
}));

vi.mock('../src/core/federation/federatedGateway.js', () => ({
  federatedGateway: {
    execute: federationMocks.execute,
  },
}));

vi.mock('../src/core/dynamicToolRegistry.js', () => ({
  getDynamicToolRegistry: federationMocks.getDynamicToolRegistry,
}));

vi.mock('../src/core/toolRegistry.js', () => ({
  getToolRegistry: federationMocks.getToolRegistry,
}));

vi.mock('../src/server/registry.js', () => ({
  getRegisteredToolsList: federationMocks.getRegisteredToolsList,
}));

describe('Federation routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();

    federationMocks.listPeers.mockReturnValue([
      { peerId: 'peer-1', displayName: 'Peer 1', endpoint: 'https://peer-1', trustState: 'trusted' },
    ]);
    federationMocks.register.mockResolvedValue({
      peerId: 'peer-2',
      displayName: 'Peer 2',
      endpoint: 'https://peer-2',
      trustState: 'trusted',
    });
    federationMocks.revoke.mockResolvedValue({
      peerId: 'peer-1',
      displayName: 'Peer 1',
      endpoint: 'https://peer-1',
      trustState: 'revoked',
      revokedAt: '2026-03-30T10:00:00.000Z',
    });
    federationMocks.issue.mockImplementation((peerId: string, capabilities: Array<{ name: string }>) => ({
      manifestId: 'manifest-1',
      peerId,
      capabilities,
      version: '1.0',
      issuedAt: '2026-03-30T10:00:00.000Z',
      expiresAt: '2026-03-30T11:00:00.000Z',
      signature: 'signature',
    }));
    federationMocks.listManifestsForPeer.mockReturnValue([]);
    federationMocks.verify.mockReturnValue('valid');
    federationMocks.listSessions.mockReturnValue([
      {
        sessionId: 'session-1',
        state: 'offering',
        initialOffer: {
          offerId: 'offer-1',
          fromPeerId: 'local',
          toPeerId: 'peer-1',
          capabilities: ['agent_list'],
          terms: {},
          proposedAt: '2026-03-30T10:00:00.000Z',
        },
        createdAt: '2026-03-30T10:00:00.000Z',
        requiresApproval: false,
        transcript: [],
      },
    ]);
    federationMocks.createOffer.mockResolvedValue({ sessionId: 'session-2' });
    federationMocks.accept.mockResolvedValue({ sessionId: 'session-1', state: 'accepted' });
    federationMocks.reject.mockResolvedValue({ sessionId: 'session-1', state: 'rejected' });
    federationMocks.execute.mockResolvedValue({ success: true, peerId: 'peer-1', data: { ok: true } });
    federationMocks.getDynamicToolRegistry.mockReturnValue({
      getAll: () => [
        {
          manifest: {
            id: 'dynamic-tool',
            description: 'Dynamic tool',
            version: '2.0.0',
            deprecated: true,
            deprecatedMessage: 'use something else',
          },
        },
      ],
    });
    federationMocks.getRegisteredToolsList.mockReturnValue([
      { id: 'agent_list', description: 'Lists agents' },
    ]);
    federationMocks.getToolRegistry.mockResolvedValue({
      getToolDefinitions: () => [
        { name: 'delegate_Developer', description: 'Delegates to Developer agent' },
      ],
    });

    app = express();
    app.use(express.json());
    app.use('/api/v1/federation', createFederationRouter());
  });

  it('lists registered peers', async () => {
    const response = await request(app).get('/api/v1/federation/peers');

    expect(response.status).toBe(200);
    expect(response.body.peers).toHaveLength(1);
    expect(federationMocks.listPeers).toHaveBeenCalledOnce();
  });

  it('registers peers through the router', async () => {
    const response = await request(app)
      .post('/api/v1/federation/peers/register')
      .send({ peerId: 'peer-2', displayName: 'Peer 2', endpoint: 'https://peer-2' });

    expect(response.status).toBe(201);
    expect(federationMocks.register).toHaveBeenCalledWith({
      peerId: 'peer-2',
      displayName: 'Peer 2',
      endpoint: 'https://peer-2',
    });
  });

  it('builds the local manifest from real registry sources', async () => {
    const response = await request(app).get('/api/v1/federation/manifests/local');

    expect(response.status).toBe(200);
    expect(federationMocks.issue).toHaveBeenCalledOnce();
    expect(federationMocks.issue.mock.calls[0][1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'dynamic-tool', version: '2.0.0', deprecated: true }),
      expect.objectContaining({ name: 'agent_list' }),
      expect.objectContaining({ name: 'delegate_Developer' }),
    ]));
  });

  it('executes remote federation requests through the gateway', async () => {
    const response = await request(app)
      .post('/api/v1/federation/execute')
      .send({ capabilityName: 'agent_list', payload: { sample: true } });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(federationMocks.execute).toHaveBeenCalledWith({ capabilityName: 'agent_list', payload: { sample: true } });
  });
});