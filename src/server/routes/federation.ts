import { Router } from 'express';
import { trustRegistry } from '../../core/federation/trustRegistry.js';
import { capabilityManifestManager } from '../../core/federation/capabilityManifest.js';
import { federatedGateway } from '../../core/federation/federatedGateway.js';
import { negotiationProtocol } from '../../core/federation/negotiationProtocol.js';
import { logInfo, logError } from '../../utils/logger.js';

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
    } catch (e: any) {
      logError('FederationRouter', `Registration failed: ${e.message}`);
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/peers/:id/revoke', async (req, res) => {
    const peer = await trustRegistry.revoke(req.params.id, req.body.reason);
    if (!peer) return res.status(404).json({ error: 'Peer not found' });
    res.json(peer);
  });

  // ── Manifests ──────────────────────────────────────────────────────────────

  router.get('/manifests/local', (req, res) => {
    // Generate a manifest of local capabilities (mocked for now based on registry or dynamic tools)
    // In a real scenario, this would scan registered agents/tools.
    const manifest = capabilityManifestManager.issue('local-bas', [
      { name: 'chat', description: 'AI Chat' },
      { name: 'web_search', description: 'Web Search' },
    ]);
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
    } catch (e: any) {
      res.status(400).json({ error: e.message });
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
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
