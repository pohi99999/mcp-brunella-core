import { Router } from 'express';

export function createCrmFollowUpRoutes(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ ok: true, message: 'CRM follow-up routes minimized' });
  });
  return router;
}

export default createCrmFollowUpRoutes;
