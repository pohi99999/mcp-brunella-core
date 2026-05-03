/**
 * Phase 6 API Routes: Enterprise Suite Integration
 * Provides REST endpoints for managing and monitoring all 14 enterprise modules
 */

import express, { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger.js';
import { moduleRegistry } from '../services/ModuleRegistry.js';

const router = express.Router();

/**
 * GET /api/enterprise/modules
 * Get registry of all 14 enterprise modules
 */
router.get('/modules', (req: Request, res: Response) => {
  try {
    const modules = moduleRegistry.getAllModules();
    const stats = moduleRegistry.getStats();
    
    res.json({
      status: 'success',
      count: modules.length,
      stats,
      modules
    });
  } catch (error) {
    logError('EnterpriseAPI', `Failed to get modules: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve module registry'
    });
  }
});

/**
 * GET /api/enterprise/modules/:category
 * Get modules by category (sales, finance, hr, logistics)
 */
router.get('/modules/:category', (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const validCategories = ['sales', 'finance', 'hr', 'logistics'];
    
    if (!validCategories.includes(category as string)) {
      return res.status(400).json({
        status: 'error',
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }
    
    const modules = moduleRegistry.getModulesByCategory(
      category as 'sales' | 'finance' | 'hr' | 'logistics'
    );
    
    res.json({
      status: 'success',
      category,
      count: modules.length,
      modules
    });
  } catch (error) {
    logError('EnterpriseAPI', `Failed to get modules by category: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve modules by category'
    });
  }
});

/**
 * POST /api/enterprise/execute
 * Execute a task against the enterprise suite
 *
 * Body:
 * {
 *   "task": "Find leads in tech industry",
 *   "priority": "high",
 *   "targetModules": ["SalesAgent", "PricingAgent"] // optional
 * }
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { task, priority } = req.body;
    
    if (!task || typeof task !== 'string') {
      return res.status(400).json({
        status: 'error',
        error: 'task (string) is required'
      });
    }
    
    logInfo('EnterpriseAPI', `Executing task: ${task.slice(0, 50)}...`);
    
    // In production, this would route to the actual orchestrator
    // For now, return a simulated response
    res.json({
      status: 'success',
      result: {
        taskId: `task_${Date.now()}`,
        task,
        priority: priority || 'medium',
        status: 'queued',
        executedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logError('EnterpriseAPI', `Failed to execute task: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: 'Failed to execute enterprise task'
    });
  }
});

/**
 * GET /api/enterprise/health
 * Get health status of all modules
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const stats = moduleRegistry.getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      modules: stats,
      summary: {
        totalModules: stats.totalModules,
        categories: stats.categories.length,
        ready: true
      }
    });
  } catch (error) {
    logError('EnterpriseAPI', `Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/enterprise/stats
 * Get execution statistics and metrics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = moduleRegistry.getStats();
    
    res.json({
      status: 'success',
      stats: {
        ...stats,
        queryTime: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  } catch (error) {
    logError('EnterpriseAPI', `Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve statistics'
    });
  }
});

export default router;
