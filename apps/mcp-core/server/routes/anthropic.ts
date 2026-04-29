// src/server/routes/anthropic.ts
import express from 'express';
import { sendAnthropicMessage } from '@packages/core-logic/anthropicClient.js';

const router = express.Router();

/** POST /api/v1/anthropic/test
 *  Body: { message: string, model?: string, system?: string }
 */
router.post('/api/v1/anthropic/test', async (req, res) => {
  const incoming = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!incoming) {
    return res.status(400).json({ ok: false, error: 'Missing "message" in request body' });
  }

  const model = typeof req.body?.model === 'string' && req.body.model.trim().length > 0 ? req.body.model.trim() : undefined;
  const system = typeof req.body?.system === 'string' && req.body.system.trim().length > 0 ? req.body.system.trim() : undefined;
  const messages = system
    ? [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: incoming },
      ]
    : [{ role: 'user' as const, content: incoming }];

  try {
    const reply = await sendAnthropicMessage(messages, model);
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
