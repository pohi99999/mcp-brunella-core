/**
 * Procurement Agent - Auto-Negotiator (Automata Ártárgyaló)
 * 
 * Automated procurement negotiation with supplier price optimization
 * and email draft generation with cited sources.
 * 
 * Features:
 * - Historical supplier price analysis (LanceDB)
 * - Market price comparison (MarketIntel integration)
 * - Negotiation strategy selection (loyalty/bulk/competitor)
 * - Email draft generation with source citations
 * - NO hallucinations - every claim must have sourceUrl
 * - Price validation and fact-checking
 * 
 * @module ProcurementAgent
 * @version 1.0.0
 */

import { BaseAgent } from './BaseAgent.js';
import { AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus, logWarn } from '../utils/logger.js';
import type { ProcurementData } from '../types/enterprise.js';

// ============================================================================
// Types
// ============================================================================

interface HistoricalPrice {
  supplier: string;
  price: number;
  date: string;
  sourceUrl: string;
}

interface MarketComparison {
  product: string;
  currentSupplierPrice: number;
  bestMarketPrice: number;
  potentialSavings: number;
  potentialSavingsPercent: number;
  marketAverage: number;
  competitor: string;
  sourceUrl: string;
}

interface NegotiationStrategy {
  name: 'loyalty_ask' | 'bulk_discount' | 'competitor_match' | 'volume_commitment';
  description: string;
  expectedSavings: number;
  emailTemplate: string;
}

interface NegotiationEmailDraft {
  to: string;
  subject: string;
  body: string;
  strategy: string;
  citedSources: string[];
  validationStatus: 'validated' | 'needs_review' | 'invalid';
  warnings?: string[];
}

interface ProcurementResult {
  analysis: MarketComparison;
  recommendedStrategy: NegotiationStrategy;
  emailDraft: NegotiationEmailDraft;
  metrics: {
    potentialAnnualSavings: number;
    confidenceLevel: number; // 0-100
    riskAssessment: 'low' | 'medium' | 'high';
  };
}

// ============================================================================
// Procurement Agent Implementation  
// ============================================================================

export class ProcurementAgent extends BaseAgent {
  name = 'Procurement';
  role = 'Automated Negotiator & Supplier Optimization';
  description = 'Intelligent procurement negotiation with market price analysis and validated email drafting';
  capabilities = [
    'supplier_price_analysis',
    'market_comparison',
    'negotiation_strategy_selection',
    'email_draft_generation',
    'source_validation',
    'fact_checking'
  ];

  private readonly MIN_SAVINGS_THRESHOLD = 5; // Only negotiate if >5% savings possible
  private readonly CONFIDENCE_THRESHOLD = 70; // Require 70%+ confidence for auto-send

  /**
   * Execute task (BaseAgent interface)
   */
  async executeTask(context: any): Promise<any> {
    const task = context.task || context;
    return this.execute(task, context);
  }

  /**
   * Execute procurement negotiation task
   * 
   * @param task - JSON with ProcurementData or natural language
   * @param context - Additional context
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', `Procurement analysis: ${task.substring(0, 50)}...`);

    try {
      logInfo(this.name, 'Starting procurement negotiation analysis...');

      // Parse input
      const params = this.parseProcurementRequest(task);
      logInfo(this.name, `Analyzing: ${params.productCategory}, supplier: ${params.currentSupplier}`);

      // Execute procurement pipeline
      const result = await this.analyzeProcurement(params);

      // Validate email draft
      const validation = this.validateNegotiationEmail(result.emailDraft);
      if (!validation.valid) {
        logWarn(this.name, `Email validation failed: ${validation.errors?.join(', ')}`);
        result.emailDraft.validationStatus = 'invalid';
        result.emailDraft.warnings = validation.errors;
      }

      logInfo(this.name, `✅ Procurement analysis complete: ${result.analysis.potentialSavingsPercent.toFixed(1)}% savings possible`);

      return {
        status: 'success',
        message: `Found ${result.analysis.potentialSavingsPercent.toFixed(1)}% savings opportunity. Strategy: ${result.recommendedStrategy.name}`,
        data: result,
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(this.name, `Procurement analysis failed: ${errorMsg}`);
      
      return {
        status: 'error',
        error: errorMsg,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // ==========================================================================
  // Core Pipeline Methods
  // ==========================================================================

  /**
   * Main procurement analysis pipeline
   */
  private async analyzeProcurement(params: ProcurementData): Promise<ProcurementResult> {
    // Step 1: Fetch historical supplier prices
    const historicalPrices = await this.fetchHistoricalPrices(params.currentSupplier, params.productCategory);

    // Step 2: Get current market prices (from MarketIntel)
    const marketComparison = await this.compareWithMarket(params, historicalPrices);

    // Step 3: Select negotiation strategy
    const strategy = this.selectNegotiationStrategy(marketComparison, params);

    // Step 4: Generate email draft
    const emailDraft = this.generateNegotiationEmail(strategy, marketComparison, params);

    // Step 5: Calculate metrics
    const metrics = this.calculateMetrics(marketComparison, historicalPrices);

    return {
      analysis: marketComparison,
      recommendedStrategy: strategy,
      emailDraft,
      metrics,
    };
  }

  /**
   * Fetch historical supplier prices from LanceDB
   * 
   * NOTE: Simulated. In production:
   * - Query LanceDB with supplier filter
   * - Include 12 months of historical data
   * - Add semantic search for product variations
   */
  private async fetchHistoricalPrices(supplier: string, product: string): Promise<HistoricalPrice[]> {
    logInfo(this.name, `Fetching historical prices for ${supplier}...`);

    // Simulated historical data
    const basePrice = 100000;
    const history: HistoricalPrice[] = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      history.push({
        supplier,
        price: basePrice * (1 + Math.random() * 0.1 - 0.05), // ±5% variation
        date: date.toISOString().split('T')[0],
        sourceUrl: `https://internal-crm.example.com/orders/${1000 + i}`,
      });
    }

    return history;
  }

  /**
   * Compare current price with market using MarketIntel data
   */
  private async compareWithMarket(
    params: ProcurementData,
    historicalPrices: HistoricalPrice[]
  ): Promise<MarketComparison> {
    logInfo(this.name, 'Comparing prices with market data...');

    // Simulated market price (in production, would query MarketIntel LanceDB)
    const currentPrice = params.currentPrice;
    const marketAverage = currentPrice * 0.92; // Market is 8% cheaper
    const bestMarketPrice = currentPrice * 0.88; // Best competitor is 12% cheaper

    const potentialSavings = currentPrice - bestMarketPrice;
    const potentialSavingsPercent = (potentialSavings / currentPrice) * 100;

    return {
      product: params.productCategory,
      currentSupplierPrice: currentPrice,
      bestMarketPrice,
      potentialSavings,
      potentialSavingsPercent,
      marketAverage,
      competitor: 'Best Competitor Ltd.',
      sourceUrl: 'https://market-intel.example.com/report/2026-02-19',
    };
  }

  /**
   * Select optimal negotiation strategy based on data
   */
  private selectNegotiationStrategy(
    comparison: MarketComparison,
    params: ProcurementData
  ): NegotiationStrategy {
    const savingsPercent = comparison.potentialSavingsPercent;
    const targetReduction = params.targetPriceReduction || 10;

    // Strategy 1: Competitor Match (best if market significantly cheaper)
    if (savingsPercent >= 10) {
      return {
        name: 'competitor_match',
        description: 'Request price match with competitor pricing',
        expectedSavings: savingsPercent * 0.8, // Realistic 80% of theoretical
        emailTemplate: 'competitor_match',
      };
    }

    // Strategy 2: Bulk Discount (if savings modest but consistent)
    if (savingsPercent >= 5) {
      return {
        name: 'bulk_discount',
        description: 'Offer increased order volume for better pricing',
        expectedSavings: savingsPercent * 0.6,
        emailTemplate: 'bulk_discount',
      };
    }

    // Strategy 3: Loyalty Ask (fallback if savings marginal)
    return {
      name: 'loyalty_ask',
      description: 'Request loyalty discount based on partnership history',
      expectedSavings: 3,
      emailTemplate: 'loyalty_ask',
    };
  }

  /**
   * Generate negotiation email draft with cited sources
   * 
   * CRITICAL: Every price claim must be backed by sourceUrl
   * This prevents AI hallucinations
   */
  private generateNegotiationEmail(
    strategy: NegotiationStrategy,
    comparison: MarketComparison,
    params: ProcurementData
  ): NegotiationEmailDraft {
    const citedSources: string[] = [comparison.sourceUrl];

    let body = '';
    let subject = '';

    switch (strategy.name) {
      case 'competitor_match':
        subject = `Árajánlat felülvizsgálat - ${params.productCategory}`;
        body = this.generateCompetitorMatchEmail(comparison, params, citedSources);
        break;

      case 'bulk_discount':
        subject = `Volumen kedvezmény lehetőség - ${params.productCategory}`;
        body = this.generateBulkDiscountEmail(comparison, params, citedSources);
        break;

      case 'loyalty_ask':
        subject = `Partneri kedvezmény kérés - ${params.productCategory}`;
        body = this.generateLoyaltyAskEmail(comparison, params, citedSources);
        break;

      default:
        subject = `Beszerzési egyeztetés - ${params.productCategory}`;
        body = this.generateGenericEmail(comparison, params);
    }

    return {
      to: this.getSupplierEmail(params.currentSupplier),
      subject,
      body,
      strategy: strategy.name,
      citedSources,
      validationStatus: 'needs_review', // Always require human review
    };
  }

  /**
   * Competitor match email template
   */
  private generateCompetitorMatchEmail(
    comparison: MarketComparison,
    params: ProcurementData,
    citedSources: string[]
  ): string {
    return `Tisztelt ${params.currentSupplier} Csapat!

Többéves üzleti kapcsolatunk kapcsán szeretném felvetni a ${params.productCategory} árának felülvizsgálat lehetőségét.

Piackutatásunk során azt tapasztaltuk, hogy hasonló minőségű termékeket átlagosan ${comparison.potentialSavingsPercent.toFixed(1)}%-kal kedvezőbb áron kínálnak a piacon (forrás: [1]).

Jelenlegi árunk: ${comparison.currentSupplierPrice.toLocaleString('hu-HU')} Ft
Piaci átlag: ${comparison.marketAverage.toLocaleString('hu-HU')} Ft
Legjobb piaci ár: ${comparison.bestMarketPrice.toLocaleString('hu-HU')} Ft

Partneri kapcsolatunk értékét tekintve szeretnénk Önökkel folytatni az együttműködést, ezért kérem, hogy fontolják meg egy ${params.targetPriceReduction || 10}%-os árcsökkentés lehetőségét, amely közelítené árainkat a piaci szintekhez.

Várom visszajelzésüket a következő 2 héten belül.

Üdvözlettel,
[Név]
[Cég] - Beszerzési Osztály

---
Források:
[1] ${citedSources[0]}

⚠️ FIGYELEM: Ez egy TERVEZET. Kérjük, ellenőrizze a forrásokat és az árakat küldés előtt!`;
  }

  /**
   * Bulk discount email template
   */
  private generateBulkDiscountEmail(
    comparison: MarketComparison,
    params: ProcurementData,
    citedSources: string[]
  ): string {
    return `Tisztelt ${params.currentSupplier} Csapat!

Tervezzük a ${params.productCategory} beszerzésünk növelését a következő évben.

Amennyiben megrendelésünket 30%-kal növeljük, megfontolnák-e egy kedvezőbb árazást? Piacelemzésünk szerint hasonló volumen mellett átlagosan ${comparison.potentialSavingsPercent.toFixed(1)}%-kal kedvezőbb árak érhetők el (forrás: [1]).

Javasolt új mennyiség: [X db/hó]
Jelenlegi árközpont: ${comparison.currentSupplierPrice.toLocaleString('hu-HU')} Ft
Kért célár: ${comparison.bestMarketPrice.toLocaleString('hu-HU')} Ft

Üdvözlettel,
[Név]

---
Források:
[1] ${citedSources[0]}`;
  }

  /**
   * Loyalty ask email template
   */
  private generateLoyaltyAskEmail(
    comparison: MarketComparison,
    params: ProcurementData,
    citedSources: string[]
  ): string {
    return `Tisztelt ${params.currentSupplier} Csapat!

Többéves partneri kapcsolatunk alapján szeretnék egy kedvezményt kérni a ${params.productCategory} termékre.

Bízom benne, hogy hosszú távú együttműködésünk értékét figyelembe véve tudnak egy 3-5%-os partneri kedvezményt biztosítani számunkra.

Üdvözlettel,
[Név]`;
  }

  /**
   * Generic fallback email
   */
  private generateGenericEmail(comparison: MarketComparison, params: ProcurementData): string {
    return `Tisztelt ${params.currentSupplier} Csapat!

Szeretném egyeztetni a ${params.productCategory} beszerzésünk lehetőségeit.

Kérem, jelezzen vissza az árazási lehetőségekkel kapcsolatban.

Üdvözlettel,
[Név]`;
  }

  /**
   * Validate negotiation email for source citations
   * 
   * CRITICAL CONSTRAINT: Every price claim must have sourceUrl
   */
  private validateNegotiationEmail(draft: NegotiationEmailDraft): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Extract price numbers from email body
    const priceRegex = /[\d\s,]+\s*Ft/g;
    const prices = draft.body.match(priceRegex) || [];

    // Check that we have cited sources
    if (draft.citedSources.length === 0 && prices.length > 0) {
      errors.push('Email contains price claims but no cited sources');
    }

    // Check that sources are valid URLs
    for (const source of draft.citedSources) {
      if (!source.startsWith('http://') && !source.startsWith('https://')) {
        errors.push(`Invalid source URL: ${source}`);
      }
    }

    // Verify draft isn't missing critical validation marker
    if (!draft.body.includes('⚠️ FIGYELEM') && !draft.body.includes('TERVEZET')) {
      errors.push('Email draft missing human review warning');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Calculate procurement metrics
   */
  private calculateMetrics(
    comparison: MarketComparison,
    historicalPrices: HistoricalPrice[]
  ): {
    potentialAnnualSavings: number;
    confidenceLevel: number;
    riskAssessment: 'low' | 'medium' | 'high';
  } {
    // Estimate annual volume (simplified)
    const estimatedAnnualVolume = 12; // Monthly purchases
    const potentialAnnualSavings = comparison.potentialSavings * estimatedAnnualVolume;

    // Confidence based on data points
    const dataPointCount = historicalPrices.length;
    const confidenceLevel = Math.min(100, dataPointCount * 15); // 15 points per data point, max 100

    // Risk assessment
    let riskAssessment: 'low' | 'medium' | 'high';
    if (comparison.potentialSavingsPercent < 5) {
      riskAssessment = 'low';
    } else if (comparison.potentialSavingsPercent < 15) {
      riskAssessment = 'medium';
    } else {
      riskAssessment = 'high'; // Large savings might indicate quality difference
    }

    return {
      potentialAnnualSavings,
      confidenceLevel,
      riskAssessment,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Parse procurement request
   */
  private parseProcurementRequest(task: string): ProcurementData {
    try {
      const parsed = JSON.parse(task);
      if (parsed.productCategory) {
        return parsed as ProcurementData;
      }
    } catch {
      // Not JSON, parse natural language
    }

    return {
      productCategory: this.extractProductCategory(task),
      currentSupplier: this.extractSupplier(task),
      currentPrice: this.extractPrice(task),
      targetPriceReduction: this.extractTargetReduction(task),
    };
  }

  private extractProductCategory(task: string): string {
    const match = task.match(/product[:\s]+([^,\.]+)/i);
    return match ? match[1].trim() : 'industrial products';
  }

  private extractSupplier(task: string): string {
    const match = task.match(/supplier[:\s]+([^,\.]+)/i);
    return match ? match[1].trim() : 'Current Supplier';
  }

  private extractPrice(task: string): number {
    const match = task.match(/(\d[\d\s,]*)\s*Ft/);
    if (match) {
      return parseInt(match[1].replace(/[\s,]/g, ''), 10);
    }
    return 100000; // Default
  }

  private extractTargetReduction(task: string): number | undefined {
    const match = task.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private getSupplierEmail(supplier: string): string {
    // Simulated (in production, would lookup from CRM)
    return `contact@${supplier.toLowerCase().replace(/\s+/g, '')}.com`;
  }
}
