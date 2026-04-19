import { Router } from 'express';

export function createBookkeepingStatusSnapshotRoutes(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ ok: true, message: 'Bookkeeping status snapshot routes minimized' });
  });
  return router;
}

export default createBookkeepingStatusSnapshotRoutes;
