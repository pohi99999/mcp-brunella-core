import { Router } from 'express';
import { trustRegistry } from '../../core/federation/trustRegistry.js';
import { capabilityManifestManager } from '../../core/federation/capabilityManifest.js';
import { federatedGateway } from '../../core/federation/federatedGateway.js';
import { negotiationProtocol } from '../../core/federation/negotiationProtocol.js';
import { getDynamicToolRegistry } from '../../core/dynamicToolRegistry.js';
import { getToolRegistry } from '../../core/toolRegistry.js';
import { getRegisteredToolsList } from '../registry.js';
import { logError } from '../../utils/logger.js';

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

  for (const tool of getRegisteredToolsList()) {
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

export function createFederationRouter(): Router {
  const router = Router();

  // ── Peers ──────────────────────────────────────────────────────────────────

  router.get('/peers', (req, res) => {
    const peers = trustRegistry.listPeers();
    res.json({ peers, count: peers.length });
  });

  router.post('/peers/register', async (req, res) => {
    try {
      const peer = await trustRegistry.register(req.body);
      res.status(201).json(peer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('FederationRouter', `Registration failed: ${message}`);
      res.status(400).json({ error: message });
    }
  });

  router.post('/peers/:id/revoke', async (req, res) => {
    const peer = await trustRegistry.revoke(req.params.id, req.body.reason);
    if (!peer) return res.status(404).json({ error: 'Peer not found' });
    res.json(peer);
  });

  // ── Manifests ──────────────────────────────────────────────────────────────

  router.get('/manifests/local', async (req, res) => {
    const capabilities = await buildLocalCapabilities();
    const manifest = capabilityManifestManager.issue('local-bas', capabilities);
    res.json(manifest);
  });

  router.get('/manifests/peer/:peerId', (req, res) => {
    const manifests = capabilityManifestManager.listManifestsForPeer(req.params.peerId);
    res.json({ manifests, count: manifests.length });
  });

  router.post('/manifests/verify', (req, res) => {
    const result = capabilityManifestManager.verify(req.body);
    res.json({ result });
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

  router.post('/negotiations/:id/reject', async (req, res) => {
    const session = await negotiationProtocol.reject(req.params.id, req.body.reason);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  // ── Execution ──────────────────────────────────────────────────────────────

  router.post('/execute', async (req, res) => {
    try {
      const result = await federatedGateway.execute(req.body);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
