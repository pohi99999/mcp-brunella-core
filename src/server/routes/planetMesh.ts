/**
 * src/server/routes/planetMesh.ts
 *
 * REST API végpontok a Planet Mesh, Emergent Layer és az Edge Colonies állapotának
 * lekérdezéséhez a Dashboard felől.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logError } from '../../utils/logger.js';
import { SingularityKernel } from '../../kernel/SingularityKernel.js';

const router = Router();

// Mivel itt statikus routert építünk, a DI (Dependency Injection) feloldása így történne egy middleware-en át
router.use((req: Request, res: any, next: NextFunction) => {
  if (!(req as any).app.locals.singularityKernel) {
    (req as any).app.locals.singularityKernel = new SingularityKernel();
  }
  next();
});

router.get('/status', async (req: Request, res: any) => {
  try {
    const kernel: SingularityKernel = (req as any).app.locals.singularityKernel;
    
    const overview = kernel.orchestrator.getSystemOverview();
    
    // Szimulált API válasz
    res.json({
      success: true,
      status: 'active',
      data: overview,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('PlanetMesh API', `Error fetching status: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

router.get('/emergent-patterns', async (req: Request, res: any) => {
  try {
    const kernel: SingularityKernel = (req as any).app.locals.singularityKernel;
    
    const patterns = kernel.emergentLayer.getEmergentPatterns(0);
    
    res.json({
      success: true,
      data: patterns,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('PlanetMesh API', `Error fetching emergent patterns: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

export default router;
