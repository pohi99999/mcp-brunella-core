/**
 * src/server/routes/planetMesh.ts
 *
 * REST API végpontok a Planet Mesh és Emergent Layer állapotának lekérdezéséhez.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logError } from '../../utils/logger.js';
import { SingularityKernel } from '../../kernel/SingularityKernel.js';

const router = Router();

router.use((req: Request, res: any, next: NextFunction) => {
  if (!(req as any).app.locals.singularityKernel) {
    (req as any).app.locals.singularityKernel = new SingularityKernel();
  }
  next();
});

router.get('/status', async (req: Request, res: any) => {
  try {
    res.json({
      success: true,
      status: 'active',
      data: { message: 'Kernel status fetched via planetMesh route' },
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('PlanetMesh API', `Error fetching status: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

export default router;
