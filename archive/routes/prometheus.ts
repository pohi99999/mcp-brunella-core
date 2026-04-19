import { Router } from 'express';

export function createPrometheusRoutes(): Router {
  const router = Router();
  router.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send('# Metrics minimized for build stability\n');
  });
  return router;
}

export default createPrometheusRoutes;
