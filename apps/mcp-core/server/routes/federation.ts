import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { agentManager } from '@packages/agents/AgentManager.js';
import type { FederatedAgent } from '@packages/agents/federation/FederatedAgentManager.js';
import { trustRegistry } from '@packages/core-logic/federation/trustRegistry.js';
import { capabilityManifestManager, isCapabilityManifestConfigError } from '@packages/core-logic/federation/capabilityManifest.js';
import { negotiationProtocol } from '@packages/core-logic/federation/negotiationProtocol.js';
import { buildFederationEvidenceSnapshot } from '@packages/core-logic/federation/evidence.js';
import { getDynamicToolRegistry } from '@packages/core-logic/dynamicToolRegistry.js';
import { getToolRegistry } from '@packages/core-logic/toolRegistry.js';
import { getRegisteredToolsList } from '../registry.js';
import { allowLoopbackWithoutAuth, authFederationPeer } from '../middleware/federationAuth.js';
import { executeLocalTool } from '../toolRegistry.js';
import { getLocalFederationPeerId } from '@packages/core-logic/federationPeerAuth.js';
import { logError } from '@packages/utils/logger.js';

const federationManifestCapabilitySchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().min(1).max(4096),
  version: z.string().min(1).max(128).optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  deprecated: z.boolean().optional(),
  deprecatedMessage: z.string().min(1).max(4096).optional(),
});

const federationManifestSchema = z.object({
  manifestId: z.string().uuid(),
  peerId: z.string().min(1).max(256),
  capabilities: z.array(federationManifestCapabilitySchema),
  version: z.string().min(1).max(64),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  signature: z.string().regex(/^[0-9a-f]{64}$/i),
});

async function buildLocalCapabilities() {
  const capabilities = new Map<string, {
    name: string;
    description: string;
    version?: string;
    deprecated?: boolean;
    deprecatedMessage?: string;
  }>();

  const dynamicEntries = getDynamicToolRegistry().getAll();
  for (const entry of dynamicEntries) {
    capabilities.set(entry.manifest.id, {
      name: entry.manifest.id,
      description: entry.manifest.description,
      version: entry.manifest.version,
      deprecated: entry.manifest.deprecated,
      deprecatedMessage: entry.manifest.deprecatedMessage,
    });
  }

  for (const tool of await getRegisteredToolsList()) {
    if (!capabilities.has(tool.id)) {
      capabilities.set(tool.id, {
        name: tool.id,
        description: tool.description,
        version: '1.0.0',
      });
    }
  }

  const registry = await getToolRegistry();
  for (const tool of registry.getToolDefinitions()) {
    if (!capabilities.has(tool.name)) {
      capabilities.set(tool.name, {
        name: tool.name,
        description: tool.description,
        version: '1.0.0',
      });
    }
  }

  return Array.from(capabilities.values())
    .sort((left, right) => left.name.localeCompare(right.name));
}

function mapFederatedAgentStatus(status: string): FederatedAgent['status'] {
  switch (status) {
    case 'working':
      return 'busy';
    case 'error':
    case 'unloaded':
      return 'offline';
    default:
      return 'available';
  }
}

function buildLocalFederatedAgents(req: Request): FederatedAgent[] {
  const localPeerId = getLocalFederationPeerId();
  const host =
    process.env.BRUNELLA_API_URL?.trim().replace(/\/+$/, '') ||
    `${req.protocol}://${req.get('host') ?? 'localhost:3000'}`;
  const lastSeen = Date.now();

  return agentManager
    .listAgents()
    .map((agentSummary) => {
      const agent = agentManager.getAgent(agentSummary.name);
      return {
        agentId: agentSummary.name,
        name: agentSummary.name,
        nodeId: localPeerId,
        host,
        capabilities: agent?.capabilities ?? [],
        status: mapFederatedAgentStatus(agentSummary.status),
        lastSeen,
        description: agentSummary.description || agent?.description,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createFederationRouter(): Router {
  const router = Router();

  const isToolExecutionFailure = (result: unknown): boolean => {
    if (typeof result !== 'object' || result === null) {
      return false;
    }

    if ('isError' in result && result.isError === true) {
      return true;
    }

    if ('success' in result && result.success === false) {
      return true;
    }

    return false;
  };

  const executeFederatedCapability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { capabilityName, payload, preferredPeerId, timeoutMs } = req.body as {
        capabilityName: string;
        payload: unknown;
        preferredPeerId?: string;
        timeoutMs?: number;
      };
      if (!capabilityName || payload === undefined) {
        res.status(400).json({ error: 'capabilityName és payload kötelező' });
        return;
      }

      if (preferredPeerId !== undefined || timeoutMs !== undefined) {
        res.status(400).json({ error: 'A federation execute inbound route csak lokális capability végrehajtást fogad.' });
        return;
      }

      const result = await executeLocalTool(capabilityName, payload);
      res.status(isToolExecutionFailure(result) ? 502 : 200).json(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      logError('FederationRoute', `federation execute hiba: ${message}`);
      res.status(500).json({ error: message });
    }
  };

  // ── Peers ──────────────────────────────────────────────────────────────────

  router.get('/peers', (req, res) => {
    const peers = trustRegistry.listPeers();
    res.json({ peers, count: peers.length });
  });

  router.post('/peers/register', allowLoopbackWithoutAuth, async (req, res) => {
    try {
      const peer = await trustRegistry.register(req.body);
      res.status(201).json(peer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('FederationRouter', `Registration failed: ${message}`);
      res.status(400).json({ error: message });
    }
  });

  router.post('/peers/:id/revoke', allowLoopbackWithoutAuth, async (req, res) => {
    const peerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const peer = await trustRegistry.revoke(peerId, req.body.reason);
    if (!peer) return res.status(404).json({ error: 'Peer not found' });
    res.json(peer);
  });

  router.post('/peers/:id/runtime-keys/stage', allowLoopbackWithoutAuth, async (req, res) => {
    try {
      const peerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const publicKey = typeof req.body?.publicKey === 'string' ? req.body.publicKey : '';
      const keyId = typeof req.body?.keyId === 'string' ? req.body.keyId : undefined;
      if (!publicKey.trim()) {
        res.status(400).json({ error: 'publicKey kötelező' });
        return;
      }

      const peer = await trustRegistry.stageNextRuntimeKey(peerId, publicKey, keyId);
      if (!peer) {
        res.status(404).json({ error: 'Peer not found' });
        return;
      }
      res.json(peer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  router.post('/peers/:id/runtime-keys/promote', allowLoopbackWithoutAuth, async (req, res) => {
    try {
      const peerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      const peer = await trustRegistry.promoteNextRuntimeKey(peerId, reason);
      if (!peer) {
        res.status(404).json({ error: 'Peer not found' });
        return;
      }
      res.json(peer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  router.get('/evidence', allowLoopbackWithoutAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 24, 100);
      const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : undefined;
      const snapshot = await buildFederationEvidenceSnapshot({ limit, peerId });
      res.json(snapshot);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  router.get('/agents', authFederationPeer, (req, res) => {
    const agents = buildLocalFederatedAgents(req);
    res.json({ agents, count: agents.length });
  });

  // ── Manifests ──────────────────────────────────────────────────────────────

  router.get('/manifests/local', allowLoopbackWithoutAuth, async (req, res) => {
    try {
      const localPeerId = getLocalFederationPeerId();
      const existing = capabilityManifestManager.getValidManifestForPeer(localPeerId);
      if (existing) {
        res.json(existing);
        return;
      }

      const capabilities = await buildLocalCapabilities();
      const manifest = capabilityManifestManager.issue(localPeerId, capabilities);
      res.json(manifest);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(isCapabilityManifestConfigError(error) ? 503 : 500).json({ error: message });
    }
  });

  router.get('/manifests/peer/:peerId', allowLoopbackWithoutAuth, (req, res) => {
    const peerId = req.params.peerId;
    if (typeof peerId !== 'string' || peerId.length > 256) {
      res.status(400).json({ error: 'Invalid peerId' });
      return;
    }

    const manifests = capabilityManifestManager.listManifestsForPeer(peerId);
    res.json({ manifests, count: manifests.length });
  });

  router.post('/manifests/verify', allowLoopbackWithoutAuth, (req, res) => {
    const parsedManifest = federationManifestSchema.safeParse(req.body);
    if (!parsedManifest.success) {
      res.status(400).json({ result: 'invalid_signature' });
      return;
    }

    try {
      capabilityManifestManager.assertSigningSecretConfigured();
      const result = capabilityManifestManager.verify(parsedManifest.data);
      res.json({ result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(isCapabilityManifestConfigError(error) ? 503 : 500).json({ error: message });
    }
  });

  // ── Negotiation ────────────────────────────────────────────────────────────

  router.get('/negotiations', (req, res) => {
    const state = req.query.state as any;
    const sessions = negotiationProtocol.listSessions(state);
    res.json({ sessions, count: sessions.length });
  });

  router.post('/negotiations/offer', async (req, res) => {
    try {
      const { toPeerId, capabilities, terms } = req.body;
      const session = await negotiationProtocol.createOffer(toPeerId, capabilities, terms);
      res.status(201).json(session);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  router.post('/negotiations/:id/accept', async (req, res) => {
    const session = await negotiationProtocol.accept(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  // ── Capabilities execute ───────────────────────────────────────────────────

  router.post('/capabilities/execute', authFederationPeer, executeFederatedCapability);

  router.post('/negotiations/:id/reject', async (req, res) => {
    const session = await negotiationProtocol.reject(req.params.id, req.body.reason);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  // ── Execution ──────────────────────────────────────────────────────────────

  router.post('/execute', authFederationPeer, executeFederatedCapability);

  return router;
}
