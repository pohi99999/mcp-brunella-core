import { Router } from 'express';

export function createWebhookHooksRoutes(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ ok: true, message: 'Webhook hooks routes minimized' });
  });
  return router;
}

export default createWebhookHooksRoutes;
