/**
 * Module Registry Service
 * Manages the configuration and information about all 14 enterprise modules
 */

interface ModuleInfo {
  name: string;
  category: 'sales' | 'finance' | 'hr' | 'logistics';
  keywords: string[];
  priority: number;
  description?: string;
}

export class ModuleRegistry {
  private modules: Map<string, ModuleInfo> = new Map();

  constructor() {
    this.initializeModules();
  }

  private initializeModules(): void {
    // Sales Modules (3)
    this.modules.set('SalesAgent', {
      name: 'SalesAgent',
      category: 'sales',
      keywords: ['lead', 'campaign', 'prospect', 'outreach', 'linkedin'],
      priority: 8,
      description: 'Automated sales lead generation and prospecting'
    });

    this.modules.set('PricingAgent', {
      name: 'PricingAgent',
      category: 'sales',
      keywords: ['price', 'quote', 'rate', 'market', 'valuation'],
      priority: 7,
      description: 'Dynamic pricing and market analysis'
    });

    this.modules.set('NegotiationEngine', {
      name: 'NegotiationEngine',
      category: 'sales',
      keywords: ['negotiate', 'discount', 'terms', 'contract', 'deal'],
      priority: 7,
      description: 'Automated contract negotiation and deal closing'
    });

    // Finance Modules (3)
    this.modules.set('FinanceGuardian', {
      name: 'FinanceGuardian',
      category: 'finance',
      keywords: ['invoice', 'expense', 'audit', 'financial', 'accounting'],
      priority: 9,
      description: 'Financial audit and invoice processing'
    });

    this.modules.set('DigitalOfficeManager', {
      name: 'DigitalOfficeManager',
      category: 'finance',
      keywords: ['email', 'triage', 'schedule', 'meeting', 'calendar'],
      priority: 6,
      description: 'Email triage and office scheduling'
    });

    this.modules.set('GrantHunter', {
      name: 'GrantHunter',
      category: 'finance',
      keywords: ['grant', 'funding', 'subsidy', 'eligibility', 'opportunity'],
      priority: 8,
      description: 'Grant opportunity finder and eligibility checker'
    });

    // HR Modules (4)
    this.modules.set('HeadHunterAgent', {
      name: 'HeadHunterAgent',
      category: 'hr',
      keywords: ['cv', 'candidate', 'recruit', 'interview', 'hiring'],
      priority: 8,
      description: 'CV screening and candidate matching'
    });

    this.modules.set('ConflictMediatorAgent', {
      name: 'ConflictMediatorAgent',
      category: 'hr',
      keywords: ['sentiment', 'conflict', 'emotion', 'team', 'resolution'],
      priority: 7,
      description: 'Sentiment analysis and conflict mediation'
    });

    this.modules.set('LocalCSRBot', {
      name: 'LocalCSRBot',
      category: 'hr',
      keywords: ['csr', 'compliance', 'sustainability', 'regulation', 'geo'],
      priority: 6,
      description: 'CSR recommendations and regulatory compliance'
    });

    this.modules.set('SentimentAnalysisModule', {
      name: 'SentimentAnalysisModule',
      category: 'hr',
      keywords: ['sentiment', 'nlp', 'emotion', 'text', 'analysis'],
      priority: 6,
      description: 'Advanced NLP-based sentiment and emotion detection'
    });

    // Logistics Modules (3)
    this.modules.set('LogisticsDispatcher', {
      name: 'LogisticsDispatcher',
      category: 'logistics',
      keywords: ['tracking', 'shipment', 'logistics', 'route', 'dispatch'],
      priority: 8,
      description: 'Shipment tracking and route optimization'
    });

    this.modules.set('KnowledgeBuilder', {
      name: 'KnowledgeBuilder',
      category: 'logistics',
      keywords: ['wiki', 'knowledge', 'project', 'index', 'rag'],
      priority: 7,
      description: 'Project indexing and RAG integration'
    });

    this.modules.set('ProactiveClaimsAgent', {
      name: 'ProactiveClaimsAgent',
      category: 'logistics',
      keywords: ['claim', 'insurance', 'complaint', 'issue', 'proactive'],
      priority: 7,
      description: 'Insurance claims processing and issue detection'
    });
  }

  /**
   * Get all modules
   */
  getAllModules(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get modules by category
   */
  getModulesByCategory(
    category: 'sales' | 'finance' | 'hr' | 'logistics'
  ): ModuleInfo[] {
    return Array.from(this.modules.values()).filter(
      (m) => m.category === category
    );
  }

  /**
   * Get module by name
   */
  getModule(name: string): ModuleInfo | undefined {
    return this.modules.get(name);
  }

  /**
   * Get statistics about modules
   */
  getStats(): {
    totalModules: number;
    byCategory: Record<string, number>;
    categories: string[];
  } {
    const stats = {
      totalModules: this.modules.size,
      byCategory: {} as Record<string, number>,
      categories: [] as string[]
    };

    this.modules.forEach((module) => {
      stats.byCategory[module.category] =
        (stats.byCategory[module.category] || 0) + 1;
    });

    stats.categories = Object.keys(stats.byCategory).sort();

    return stats;
  }
}

// Export singleton instance
export const moduleRegistry = new ModuleRegistry();
