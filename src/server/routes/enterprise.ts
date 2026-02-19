/**
 * Enterprise Module Router
 * API endpoints for BAS Enterprise Suite agents
 * 
 * Endpoints:
 * - GET /api/enterprise/modules - List all enterprise modules
 * - GET /api/enterprise/stats - Get module statistics
 * - POST /api/enterprise/execute - Execute task via enterprise orchestrator
 * - GET /api/enterprise/history - Get execution history
 * 
 * @module enterprise
 */

import { Router, Request, Response } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { logInfo, logError } from '../../utils/logger.js';

interface Module {
  name: string;
  category: string;
  keywords: string[];
  priority: number;
  status?: string;
}

interface ModuleStats {
  totalModules: number;
  byCategory: Record<string, number>;
  activeModules: number;
}

/**
 * Enterprise module metadata
 */
const ENTERPRISE_MODULES: Module[] = [
  // Phase 1: Infrastructure & Operations (Profit & Sales)
  {
    name: 'FinancialGuard',
    category: 'Infrastructure',
    keywords: ['invoice', 'payment', 'budget', 'financial', 'accounting'],
    priority: 10,
  },
  {
    name: 'PropertyAnalyst',
    category: 'Infrastructure',
    keywords: ['real estate', 'property', 'valuation', 'cma', 'market'],
    priority: 8,
  },
  {
    name: 'LogisticsDispatcher',
    category: 'Infrastructure',
    keywords: ['logistics', 'shipping', 'route', 'supply chain', 'delivery'],
    priority: 9,
  },
  // Phase 2: Finance & Administration
  {
    name: 'FinancialOracle',
    category: 'Finance',
    keywords: ['budget', 'forecast', 'financial planning', 'analysis'],
    priority: 9,
  },
  {
    name: 'InvoiceProcessor',
    category: 'Finance',
    keywords: ['invoice', 'billing', 'payment processing', 'ap'],
    priority: 8,
  },
  {
    name: 'ComplianceGuardian',
    category: 'Finance',
    keywords: ['compliance', 'legal', 'regulatory', 'audit'],
    priority: 7,
  },
  {
    name: 'WorkspaceGuard',
    category: 'Finance',
    keywords: ['workspace', 'security', 'access control', 'policy'],
    priority: 7,
  },
  // Phase 3: HR & Soft Skills
  {
    name: 'TalentScout',
    category: 'HR',
    keywords: ['recruitment', 'hiring', 'talent', 'onboarding'],
    priority: 8,
  },
  {
    name: 'CustomerEngagement',
    category: 'HR',
    keywords: ['customer', 'support', 'crm', 'engagement'],
    priority: 8,
  },
  {
    name: 'ProgramManager',
    category: 'HR',
    keywords: ['project', 'program', 'management', 'planning'],
    priority: 7,
  },
  // Phase 4: R&D & Innovation
  {
    name: 'TechInnovator',
    category: 'Innovation',
    keywords: ['research', 'development', 'innovation', 'technology'],
    priority: 8,
  },
  {
    name: 'ContentCreator',
    category: 'Innovation',
    keywords: ['content', 'marketing', 'creative', 'media'],
    priority: 7,
  },
  // Phase 5: Logistics & Knowledge
  {
    name: 'KnowledgeKeeper',
    category: 'Logistics',
    keywords: ['knowledge', 'documentation', 'wiki', 'training'],
    priority: 9,
  },
  {
    name: 'SupplyChainCoordinator',
    category: 'Logistics',
    keywords: ['supply chain', 'procurement', 'vendor', 'inventory'],
    priority: 8,
  },
];

/**
 * Create Enterprise router
 */
export function createEnterpriseRouter(): Router {
  const router = Router();

  /**
   * GET /api/enterprise/modules
   * List all enterprise modules
   */
  router.get('/modules', async (req: Request, res: Response) => {
    try {
      logInfo('EnterpriseAPI', 'Fetching enterprise modules');

      // Get agent statuses from AgentManager
      const agentStatuses = agentManager.listAgentStatuses();

      // Enrich modules with runtime status
      const modules = ENTERPRISE_MODULES.map((module) => {
        const agentStatus = agentStatuses.find((a: any) => a.name === module.name);
        return {
          ...module,
          status: agentStatus?.status || 'unknown',
          lastActivity: agentStatus?.lastTaskAt || null,
        };
      });

      res.json({
        status: 'success',
        modules,
        total: modules.length,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('EnterpriseAPI', `Failed to fetch modules: ${msg}`);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  /**
   * GET /api/enterprise/stats
   * Get module statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      logInfo('EnterpriseAPI', 'Fetching enterprise stats');

      const agentStatuses = agentManager.listAgentStatuses();

      // Calculate statistics
      const stats: ModuleStats = {
        totalModules: ENTERPRISE_MODULES.length,
        byCategory: {},
        activeModules: 0,
      };

      // Count by category
      ENTERPRISE_MODULES.forEach((module) => {
        stats.byCategory[module.category] = (stats.byCategory[module.category] || 0) + 1;
      });

      // Count active modules
      stats.activeModules = agentStatuses.filter((a: any) =>
        ENTERPRISE_MODULES.some((m) => m.name === a.name && a.status === 'working')
      ).length;

      res.json({
        status: 'success',
        stats,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('EnterpriseAPI', `Failed to fetch stats: ${msg}`);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  /**
   * POST /api/enterprise/execute
   * Execute task via enterprise orchestrator
   */
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { task, context } = req.body;

      if (!task || typeof task !== 'string') {
        return res.status(400).json({
          status: 'error',
          error: 'Task description is required',
        });
      }

      logInfo('EnterpriseAPI', `Executing enterprise task: ${task.substring(0, 100)}...`);

      // Execute task via OrchestratorAgent or direct agent execution
      const orchestrator = await agentManager.getAgent('Orchestrator');

      if (!orchestrator) {
        return res.status(503).json({
          status: 'error',
          error: 'Orchestrator agent not available',
        });
      }

      const result = await orchestrator.execute(task, context);

      res.json({
        status: 'success',
        result,
        executedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('EnterpriseAPI', `Failed to execute task: ${msg}`);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  /**
   * GET /api/enterprise/history
   * Get execution history (placeholder - integrate with task queue later)
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      logInfo('EnterpriseAPI', 'Fetching execution history');

      // TODO: Integrate with TaskQueueManager for real history
      const history: any[] = [];

      res.json({
        status: 'success',
        history,
        total: history.length,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('EnterpriseAPI', `Failed to fetch history: ${msg}`);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  return router;
}
