import { Router } from 'express';

export function createTenantsRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ ok: true, message: 'Tenants routes minimized' });
  });
  return router;
}

export default createTenantsRouter;
