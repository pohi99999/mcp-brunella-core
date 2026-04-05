/**
 * Enterprise Orchestrator Agent
 * 
 * Central coordinator for all 18 BAS Enterprise Suite modules.
 * Extends the base OrchestratorAgent with enterprise-specific routing
 * and priority management.
 * 
 * @module EnterpriseOrchestratorAgent
 * @version 1.0.0
 */

import { OrchestratorAgent } from './OrchestratorAgent.js';
import { AgentResponse } from './types.js';
import { agentManager } from './AgentManager.js';
import {
  EnterpriseEvent,
  EnterpriseAgentResponse,
  ModuleType,
  EventPriority,
  ModulePayload,
  HRPayload,
  FinancePayload,
  SalesPayload,
  LogisticsPayload,
  IntelligencePayload,
  WikiPayload
} from '../types/enterprise.js';
import { logInfo, logError, logDebug, setAgentStatus } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enterprise Orchestrator - Main coordination agent for the BAS Enterprise Suite
 */
export class EnterpriseOrchestratorAgent extends OrchestratorAgent {
  name = 'EnterpriseOrchestrator';
  role = 'Enterprise Suite Coordinator';
  description = 'Routes and manages execution of all 18 enterprise modules with priority handling';
  capabilities = [
    'enterprise_event_parsing',
    'priority_assignment',
    'module_routing',
    'execution_monitoring',
    'approval_management'
  ];

  /**
   * Module-to-Agent mapping
   * Maps each module type to its specialized agent
   */
  private moduleAgentMap: Record<ModuleType, string> = {
    HR: 'DigitalHeadhunter', // Or ConflictMediator, CSRBot based on subtype
    FINANCE: 'FinancialGuard', // Or GrantWatcher, ProcurementAgent
    SALES: 'SalesHunter', // Or MarketIntel, CampaignAutomation
    LOGISTICS: 'LogisticsDispatcher',
    INTELLIGENCE: 'MarketIntelAgent', // Or LawDetective, TrendAnalyst
    WIKI: 'KnowledgeBuilder'
  };

  /**
   * Priority keywords for automatic priority assignment
   */
  private priorityKeywords = {
    CRITICAL: [
      'urgent', 'sürgős', 'azonnal', 'immediately', 'deadline today',
      'invoice overdue', 'lejárt számla', 'delivery failed', 'sikertelen szállítás',
      'conflict escalation', 'konfliktus eszkaláció'
    ],
    HIGH: [
      'important', 'fontos', 'asap', 'új lead', 'new lead',
      'grant deadline soon', 'pályázat határidő közel', 'price drop', 'ár csökkenés',
      'competitor update', 'versenytárs frissítés'
    ],
    MEDIUM: [
      'routine', 'rutin', 'periodic', 'rendszeres', 'weekly report',
      'heti riport', 'knowledge update', 'tudásbázis frissítés'
    ]
  };

  /**
   * Execute the Enterprise Orchestrator
   * 
   * @param task - Natural language input or structured EnterpriseEvent JSON
   * @param context - Additional context (userId, etc.)
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', `Processing: ${task.substring(0, 50)}...`);

    try {
      logInfo(this.name, `Parsing enterprise intent from: "${task}"`);

      // Parse input into EnterpriseEvent
      const event = await this.parseEnterpriseIntent(task, context);
      logInfo(this.name, `Event parsed: module=${event.module}, priority=${event.priority}, type=${event.type}`);

      // Route to specialized agent
      const response = await this.routeToModule(event);

      // Store execution result
      if (event.storedInLanceDB) {
        await this.storeExecutionHistory(event, response);
      }

      return {
        status: response.status === 'success' ? 'success' : 'error',
        message: response.status === 'success' 
          ? `✅ Enterprise task completed by ${response.module} module`
          : `❌ Enterprise task failed: ${response.error}`,
        data: {
          eventId: event.id,
          module: event.module,
          priority: event.priority,
          response
        }
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Enterprise orchestration failed: ${err.message}`);
      
      return {
        status: 'error',
        error: err.message
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Parse natural language input into a structured EnterpriseEvent
   * 
   * Uses keyword matching and LLM-based intent recognition
   * 
   * @param input - User input (natural language or JSON)
   * @param context - Additional context
   */
  async parseEnterpriseIntent(input: string, context?: unknown): Promise<EnterpriseEvent> {
    // Try parsing as JSON first (for programmatic API calls)
    try {
      const parsed = JSON.parse(input);
      if (parsed.module && parsed.type) {
        return this.validateEnterpriseEvent(parsed);
      }
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(this.name, `Ignoring enterprise intent JSON parse error: ${err.message}`);
    }

    // Keyword-based module detection
    const module = this.detectModule(input);
    const priority = this.assignPriority(input);

    // Create base event structure
    const event: EnterpriseEvent = {
      id: uuidv4(),
      module,
      type: await this.detectEventType(input, module),
      payload: await this.extractPayload(input, module),
      priority,
      storedInLanceDB: true,
      timestamp: new Date().toISOString(),
      userId: this.extractUserId(context),
      status: 'pending',
      executionHistory: []
    };

    return event;
  }

  /**
   * Detect which module should handle this request
   */
  private detectModule(input: string): ModuleType {
    const lowerInput = input.toLowerCase();

    // HR keywords
    if (
      lowerInput.includes('cv') || 
      lowerInput.includes('recruitment') || 
      lowerInput.includes('candidate') ||
      lowerInput.includes('headhunter') ||
      lowerInput.includes('conflict') ||
      lowerInput.includes('mediator') ||
      lowerInput.includes('csr') ||
      lowerInput.includes('közösség')
    ) {
      return 'HR';
    }

    // Finance keywords
    if (
      lowerInput.includes('invoice') || 
      lowerInput.includes('számla') || 
      lowerInput.includes('payment') ||
      lowerInput.includes('grant') ||
      lowerInput.includes('pályázat') ||
      lowerInput.includes('procurement') ||
      lowerInput.includes('beszerzés')
    ) {
      return 'FINANCE';
    }

    // Sales keywords
    if (
      lowerInput.includes('lead') || 
      lowerInput.includes('sales') || 
      lowerInput.includes('értékesítés') ||
      lowerInput.includes('campaign') ||
      lowerInput.includes('kampány') ||
      lowerInput.includes('marketing')
    ) {
      return 'SALES';
    }

    // Logistics keywords
    if (
      lowerInput.includes('tracking') || 
      lowerInput.includes('shipment') || 
      lowerInput.includes('szállítmány') ||
      lowerInput.includes('delivery') ||
      lowerInput.includes('kézbesítés')
    ) {
      return 'LOGISTICS';
    }

    // Intelligence keywords
    if (
      lowerInput.includes('competitor') || 
      lowerInput.includes('versenytárs') || 
      lowerInput.includes('market intel') ||
      lowerInput.includes('law') ||
      lowerInput.includes('jogszabály') ||
      lowerInput.includes('trend')
    ) {
      return 'INTELLIGENCE';
    }

    // Wiki/Knowledge keywords
    if (
      lowerInput.includes('knowledge') || 
      lowerInput.includes('tudás') || 
      lowerInput.includes('wiki') ||
      lowerInput.includes('archive') ||
      lowerInput.includes('archiválás') ||
      lowerInput.includes('project completion')
    ) {
      return 'WIKI';
    }

    // Default: Use INTELLIGENCE for analysis tasks
    return 'INTELLIGENCE';
  }

  /**
   * Assign priority based on urgency keywords and context
   */
  private assignPriority(input: string): EventPriority {
    const lowerInput = input.toLowerCase();

    // Check CRITICAL keywords
    if (this.priorityKeywords.CRITICAL.some(kw => lowerInput.includes(kw))) {
      return 'CRITICAL';
    }

    // Check HIGH keywords
    if (this.priorityKeywords.HIGH.some(kw => lowerInput.includes(kw))) {
      return 'HIGH';
    }

    // Check MEDIUM keywords
    if (this.priorityKeywords.MEDIUM.some(kw => lowerInput.includes(kw))) {
      return 'MEDIUM';
    }

    // Default priority
    return 'MEDIUM';
  }

  /**
   * Detect specific event type within a module
   * (e.g., HR → recruitment vs conflict_analysis)
   */
  private async detectEventType(input: string, module: ModuleType): Promise<string> {
    const lowerInput = input.toLowerCase();

    switch (module) {
      case 'HR':
        if (lowerInput.includes('cv') || lowerInput.includes('recruitment')) return 'recruitment';
        if (lowerInput.includes('conflict')) return 'conflict_analysis';
        if (lowerInput.includes('csr')) return 'csr_opportunity';
        return 'recruitment'; // Default

      case 'FINANCE':
        if (lowerInput.includes('invoice') || lowerInput.includes('számla')) return 'invoice_processing';
        if (lowerInput.includes('grant') || lowerInput.includes('pályázat')) return 'grant_eligibility';
        if (lowerInput.includes('procurement') || lowerInput.includes('beszerzés')) return 'procurement_negotiation';
        return 'invoice_processing';

      case 'SALES':
        if (lowerInput.includes('lead')) return 'lead_generation';
        if (lowerInput.includes('market') || lowerInput.includes('price')) return 'market_intel';
        if (lowerInput.includes('campaign')) return 'campaign_automation';
        return 'lead_generation';

      case 'LOGISTICS':
        if (lowerInput.includes('complaint')) return 'complaint_generation';
        return 'shipment_tracking';

      case 'INTELLIGENCE':
        if (lowerInput.includes('law') || lowerInput.includes('jogszabály')) return 'law_monitoring';
        if (lowerInput.includes('trend')) return 'trend_detection';
        return 'competitor_analysis';

      case 'WIKI':
        if (lowerInput.includes('search') || lowerInput.includes('keresés')) return 'search_knowledge';
        if (lowerInput.includes('archive')) return 'archive_documents';
        return 'index_project';

      default:
        return 'unknown';
    }
  }

  /**
   * Extract structured payload from natural language input
   * 
   * This is a simplified parser - in production, would use LLM for complex extraction
   */
  private async extractPayload(input: string, module: ModuleType): Promise<ModulePayload> {
    // Placeholder: Return minimal valid payload structure
    // TODO: Implement LLM-based entity extraction for complex payloads

    switch (module) {
      case 'HR':
        return {
          type: 'recruitment',
          data: {
            jobDescription: input,
            requiredSkills: []
          }
        } as HRPayload;

      case 'FINANCE':
        return {
          type: 'invoice_processing',
          data: {
            extractedText: input
          }
        } as FinancePayload;

      case 'SALES':
        return {
          type: 'lead_generation',
          data: {
            industry: 'general',
            location: 'Hungary',
            companySize: 'sme',
            keywords: input.split(' ').slice(0, 5)
          }
        } as SalesPayload;

      case 'LOGISTICS':
        return {
          type: 'shipment_tracking',
          data: {
            trackingId: input.match(/[A-Z0-9]{10,}/)?.[0] || 'unknown',
            carrier: 'other'
          }
        } as LogisticsPayload;

      case 'INTELLIGENCE':
        return {
          type: 'competitor_analysis',
          data: {
            competitors: [],
            metrics: ['pricing']
          }
        } as IntelligencePayload;

      case 'WIKI':
        return {
          type: 'search_knowledge',
          data: {
            query: input
          }
        } as WikiPayload;

      default:
        throw new Error(`Unknown module type: ${module}`);
    }
  }

  /**
   * Route event to the appropriate specialized agent
   */
  async routeToModule(event: EnterpriseEvent): Promise<EnterpriseAgentResponse> {
    const targetAgent = this.moduleAgentMap[event.module];

    logInfo(this.name, `Routing to agent: ${targetAgent} (module: ${event.module})`);

    try {
      const taskDescription = typeof event.payload === 'object' && event.payload !== null
        ? JSON.stringify(event.payload)
        : String(event.payload);

      const agentResult = await agentManager.executeWithRecovery(
        targetAgent,
        taskDescription,
        { enterpriseEvent: event, priority: event.priority }
      );

      return {
        eventId: event.id,
        module: event.module,
        status: agentResult?.success ? 'success' : 'failure',
        data: agentResult?.data || agentResult,
        error: agentResult?.success ? undefined : (agentResult?.message || 'Agent execution failed')
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `routeToModule failed for ${targetAgent}: ${err.message}`);
      return {
        eventId: event.id,
        module: event.module,
        status: 'failure',
        error: err.message
      };
    }
  }

  /**
   * Store execution history in LanceDB for analytics
   */
  private async storeExecutionHistory(
    event: EnterpriseEvent,
    response: EnterpriseAgentResponse
  ): Promise<void> {
    try {
      // TODO: Implement LanceDB storage
      logInfo(this.name, `Would store execution history for event ${event.id}`);
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Failed to store execution history: ${err.message}`);
    }
  }

  /**
   * Validate EnterpriseEvent structure
   */
  private validateEnterpriseEvent(obj: unknown): EnterpriseEvent {
    // Type guard and validation logic
    const event = obj as EnterpriseEvent;
    
    if (!event.module || !event.type || !event.payload) {
      throw new Error('Invalid EnterpriseEvent: missing required fields');
    }

    return event;
  }

  /**
   * Extract userId from context
   */
  private extractUserId(context?: unknown): string | undefined {
    if (context && typeof context === 'object' && 'userId' in context) {
      return String(context.userId);
    }
    return undefined;
  }

  /**
   * Monitor execution status of an event
   */
  async monitorExecution(eventId: string): Promise<{status: string; details: string}> {
    // TODO: Implement real monitoring via LanceDB/SQLite query
    logInfo(this.name, `Monitoring execution for event ${eventId}`);
    return {
      status: 'completed',
      details: 'Mock monitoring result'
    };
  }
}

export default EnterpriseOrchestratorAgent;
