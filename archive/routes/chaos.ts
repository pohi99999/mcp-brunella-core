import { Router } from 'express';

export function createChaosRoutes(): Router {
  const router = Router();
  router.get('/status', (_req, res) => {
    res.json({ ok: true, message: 'Chaos routes minimized' });
  });
  return router;
}

export default createChaosRoutes;
