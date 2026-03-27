// src/server/routes/anthropic.ts
import express from 'express';
import { sendAnthropicMessage } from '../../services/anthropicClient.js';

const router = express.Router();

/** POST /api/v1/anthropic/test
 *  Body: { message: string }
 */
router.post('/api/v1/anthropic/test', async (req, res) => {
  const incoming = typeof req.body?.message === 'string' ? req.body.message : (req.body?.message ?? '');
  if (!incoming) {
    return res.status(400).json({ ok: false, error: 'Missing "message" in request body' });
  }

  try {
    const reply = await sendAnthropicMessage([{ role: 'user', content: incoming }]);
    return res.json({ ok: true, reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
});

export function createAnthropicRoutes() {
  return router;
}

export default router;
