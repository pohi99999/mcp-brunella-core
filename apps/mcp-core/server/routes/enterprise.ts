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
import { agentManager } from '@packages/agents/AgentManager.js';
import { EnterpriseOrchestratorAgent } from '@packages/agents/EnterpriseOrchestratorAgent.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { taskQueueManager } from '@packages/agents/taskQueue.js';

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

      // Execute task via EnterpriseOrchestratorAgent
      const orchestrator = new EnterpriseOrchestratorAgent();

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
   * Get execution history from task queue
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      logInfo('EnterpriseAPI', 'Fetching execution history');

      // Get tasks from TaskQueueManager
      const tasks = taskQueueManager.getTasks();
      const history = tasks.map((task) => ({
        id: task.id,
        type: task.type,
        description: task.description,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        result: task.result,
        error: task.error,
        retryCount: task.retryCount,
      }));

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

/**
 * Create Enterprise Analytics router (D1-powered)
 * Phase 3: Cloud-first analytics from D1 database
 */
export function createEnterpriseAnalyticsRouter(): Router {
  const router = Router();

  /**
   * GET /api/enterprise/analytics/events
   * Get enterprise events from D1
   * 
   * Query params:
   *  - type: Event type filter
   *  - limit: Max events (default: 100)
   *  - days: Days to look back (default: 7)
   */
  router.get('/events', async (req: Request, res: Response) => {
    try {
      const { type, limit = 100, days = 7 } = req.query;

      logInfo('EnterpriseAnalytics', `Fetching events: type=${type || 'all'}, limit=${limit}, days=${days}`);

      // Import D1 adapter dynamically to avoid circular deps
      const { getD1Adapter } = await import('@packages/utils/globalDb.js');
      const d1Adapter = getD1Adapter();

      // Parse input early for consistent fallback response
      const limitNum = parseInt(limit as string) || 100;
      const daysNum = parseInt(days as string) || 7;

      if (!d1Adapter) {
        return res.json({
          status: 'success',
          source: 'local-fallback',
          events: [],
          total: 0,
          query: { type: type || 'all', limit: limitNum, days: daysNum },
        });
      }

      // Fetch from D1
      const eventsResult = typeof type === 'string' && type.length > 0
        ? await d1Adapter.getEnterpriseEventsByType(type, limitNum * 2)
        : await d1Adapter.getEnterpriseEvents(limitNum * 2);

      const events = eventsResult.results || [];
      
      // Filter by days
      const cutoffTime = Date.now() - (daysNum * 24 * 60 * 60 * 1000);
      const filteredEvents = events
        .filter((e: any) => {
          const createdAt = typeof e.created_at === 'number'
            ? e.created_at
            : new Date(e.created_at).getTime();
          return Number.isFinite(createdAt) && createdAt >= cutoffTime;
        })
        .slice(0, limitNum);

      res.json({
        status: 'success',
        source: 'd1',
        events: filteredEvents,
        total: filteredEvents.length,
        query: { type: type || 'all', limit: limitNum, days: daysNum },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('EnterpriseAnalytics', `Failed to fetch events: ${msg}`);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  /**
   * GET /api/enterprise/analytics/stats
   * Get enterprise analytics statistics from D1
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      logInfo('EnterpriseAnalytics', 'Fetching analytics stats from D1');

      const { getD1Adapter } = await import('@packages/utils/globalDb.js');
      const d1Adapter = getD1Adapter();

      if (!d1Adapter) {
        return res.json({
          status: 'success',
          source: 'local-fallback',
          stats: {
            totalEvents: 0,
            byType: {},
            byPriority: {},
            byStatus: {},
            last24h: 0,
            last7d: 0,
          },
        });
      }

      // Get all recent events with high limit
      const eventsResult = await d1Adapter.getEnterpriseEvents(10000);
      const events = eventsResult.results || [];

      // Calculate statistics
      const stats = {
        totalEvents: events.length,
        byType: {} as Record<string, number>,
        byPriority: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        last24h: 0,
        last7d: 0,
      };

      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      events.forEach((event: any) => {
        // Count by type
        stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

        // Count by priority
        stats.byPriority[event.priority] = (stats.byPriority[event.priority] || 0) + 1;

        // Count by status
        stats.byStatus[event.status] = (stats.byStatus[event.status] || 0) + 1;

        // Time-based counts
        const eventTime = new Date(event.created_at).getTime();
        if (now - eventTime < day) stats.last24h++;
        if (now - eventTime < 7 * day) stats.last7d++;
      });

      res.json({
        status: 'success',
        source: 'd1',
        stats,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('EnterpriseAnalytics', `Failed to fetch stats: ${msg}`);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  /**
   * POST /api/enterprise/analytics/event
   * Create a new enterprise event in D1
   */
  router.post('/event', async (req: Request, res: Response) => {
    try {
      const { type, payload, source_module, priority = 'MEDIUM' } = req.body;

      if (!type || !payload) {
        return res.status(400).json({
          status: 'error',
          error: 'type and payload are required',
        });
      }

      logInfo('EnterpriseAnalytics', `Creating event: ${type}`);

      const { getD1Adapter } = await import('@packages/utils/globalDb.js');
      const d1Adapter = getD1Adapter();

      if (!d1Adapter) {
        return res.status(503).json({
          status: 'error',
          error: 'D1 adapter not available',
        });
      }

      await d1Adapter.insertEnterpriseEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type,
        payload: payload || {},
        source_module: source_module || 'api',
        priority,
        status: 'PENDING',
      });

      res.json({
        status: 'success',
        message: 'Event created',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('EnterpriseAnalytics', `Failed to create event: ${msg}`);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  return router;
}
