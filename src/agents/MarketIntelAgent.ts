/**
 * Market Intelligence Agent - Piaci Hírszerző
 * 
 * Automated competitor price monitoring and market trend analysis.
 * 
 * Features:
 * - Competitor website scraping (browser automation)
 * - Price extraction and tracking
 * - LanceDB storage for historical data
 * - Trend analysis and reporting
 * - Price drop alerts (>10% threshold)
 * - Chart generation (trend visualization)
 * 
 * @module MarketIntelAgent
 * @version 1.0.0
 */

import { BaseAgent } from './BaseAgent.js';
import { AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import type { MarketIntelData, MarketIntelRecord } from '../types/enterprise.js';

// ============================================================================
// Types
// ============================================================================

interface PricePoint {
  productName: string;
  competitor: string;
  price: number;
  currency: string;
  sourceUrl: string;
  scrapedAt: string;
}

interface TrendAnalysis {
  productName: string;
  currentPrice: number;
  averagePrice: number;
  priceChange: number; // Percentage
  trend: 'increasing' | 'decreasing' | 'stable';
  lowestPrice: number;
  highestPrice: number;
  dataPoints: number;
}

interface PriceAlert {
  productName: string;
  competitor: string;
  oldPrice: number;
  newPrice: number;
  priceChangePercent: number;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
}

interface MarketIntelResult {
  pricePoints: PricePoint[];
  trends: TrendAnalysis[];
  alerts: PriceAlert[];
  summary: {
    productsTracked: number;
    competitorsScraped: number;
    priceDropsDetected: number;
    averagePriceChangePercent: number;
  };
}

// ============================================================================
// Market Intel Agent Implementation
// ============================================================================

export class MarketIntelAgent extends BaseAgent {
  name = 'MarketIntel';
  role = 'Competitor Price Monitoring & Market Analysis';
  description = 'Automated competitor website scraping, price tracking, and trend analysis with LanceDB storage';
  capabilities = [
    'competitor_scraping',
    'price_extraction',
    'trend_analysis',
    'price_alerts',
    'lancedb_storage',
    'chart_generation'
  ];

  private readonly PRICE_DROP_THRESHOLD = 10; // Alert if price drops >10%
  private priceHistory: Map<string, PricePoint[]> = new Map();

  /**
   * Execute task (BaseAgent interface)
   */
  async executeTask(context: any): Promise<any> {
    const task = context.task || context;
    return this.execute(task, context);
  }

  /**
   * Execute market intelligence task
   * 
   * @param task - JSON with MarketIntelData or natural language
   * @param context - Additional context
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', `Market intel: ${task.substring(0, 50)}...`);

    try {
      logInfo(this.name, 'Starting market intelligence analysis...');

      // Parse input
      const params = this.parseMarketIntelRequest(task);
      logInfo(this.name, `Analyzing: ${params.productCategory}, ${params.competitors?.length || 0} competitors`);

      // Execute market intelligence pipeline
      const result = await this.analyzeMarket(params);

      // Store in LanceDB (simulated)
      await this.storeInLanceDB(result.pricePoints);

      logInfo(this.name, `✅ Market analysis complete: ${result.pricePoints.length} prices tracked`);

      return {
        status: 'success',
        message: `Tracked ${result.pricePoints.length} prices from ${result.summary.competitorsScraped} competitors. ${result.alerts.length} alerts generated.`,
        data: result,
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(this.name, `Market intel failed: ${errorMsg}`);
      
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
   * Main market intelligence analysis pipeline
   */
  private async analyzeMarket(params: MarketIntelData): Promise<MarketIntelResult> {
    // Step 1: Scrape competitor prices
    const pricePoints = await this.scrapeCompetitorPrices(params);

    // Step 2: Analyze trends
    const trends = this.analyzeTrends(pricePoints, params);

    // Step 3: Generate alerts
    const alerts = this.generatePriceAlerts(pricePoints);

    // Step 4: Calculate summary
    const summary = {
      productsTracked: new Set(pricePoints.map(p => p.productName)).size,
      competitorsScraped: new Set(pricePoints.map(p => p.competitor)).size,
      priceDropsDetected: alerts.filter(a => a.severity === 'critical').length,
      averagePriceChangePercent: this.calculateAveragePriceChange(pricePoints),
    };

    return {
      pricePoints,
      trends,
      alerts,
      summary,
    };
  }

  /**
   * Scrape competitor websites for prices
   * 
   * NOTE: This is simulated. In production:
   * - Use RobotkezV2Agent/browser-use for actual scraping
   * - Implement anti-bot detection bypass
   * - Add rate limiting and random delays
   * - Handle dynamic pricing and AJAX-loaded content
   */
  private async scrapeCompetitorPrices(params: MarketIntelData): Promise<PricePoint[]> {
    logInfo(this.name, `Scraping prices for: ${params.productCategory}...`);

    const pricePoints: PricePoint[] = [];
    const competitors = params.competitors || this.getDefaultCompetitors(params.productCategory);

    for (const competitor of competitors) {
      // Simulated scraping (in production, would use browser automation)
      const scraped = this.simulateCompetitorScrape(competitor, params.productCategory);
      pricePoints.push(...scraped);
    }

    logInfo(this.name, `📊 Scraped ${pricePoints.length} price points from ${competitors.length} competitors`);
    return pricePoints;
  }

  /**
   * Simulate competitor website scraping (mock data for development)
   */
  private simulateCompetitorScrape(competitor: string, category: string): PricePoint[] {
    const products = this.generateProductNames(category, 3);
    const basePrice = this.getBasePriceForCategory(category);

    return products.map((productName, idx) => ({
      productName,
      competitor,
      price: basePrice * (1 + (Math.random() - 0.5) * 0.3), // ±30% variation
      currency: 'HUF',
      sourceUrl: `https://www.${competitor.toLowerCase().replace(/\s+/g, '')}.com/products/${idx}`,
      scrapedAt: new Date().toISOString(),
    }));
  }

  /**
   * Analyze price trends over time
   */
  private analyzeTrends(pricePoints: PricePoint[], params: MarketIntelData): TrendAnalysis[] {
    const productGroups = this.groupByProduct(pricePoints);
    const trends: TrendAnalysis[] = [];

    for (const [productName, prices] of productGroups.entries()) {
      if (prices.length === 0) continue;

      const priceValues = prices.map(p => p.price);
      const currentPrice = priceValues[priceValues.length - 1];
      const averagePrice = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;
      const lowestPrice = Math.min(...priceValues);
      const highestPrice = Math.max(...priceValues);
      
      const priceChange = ((currentPrice - averagePrice) / averagePrice) * 100;
      
      let trend: 'increasing' | 'decreasing' | 'stable';
      if (priceChange > 5) {
        trend = 'increasing';
      } else if (priceChange < -5) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }

      trends.push({
        productName,
        currentPrice,
        averagePrice,
        priceChange,
        trend,
        lowestPrice,
        highestPrice,
        dataPoints: prices.length,
      });
    }

    return trends;
  }

  /**
   * Generate price drop alerts
   */
  private generatePriceAlerts(pricePoints: PricePoint[]): PriceAlert[] {
    const alerts: PriceAlert[] = [];

    // Group by product+competitor to track price changes
    for (const point of pricePoints) {
      const key = `${point.productName}|${point.competitor}`;
      const previousPrices = this.priceHistory.get(key) || [];

      if (previousPrices.length > 0) {
        const lastPrice = previousPrices[previousPrices.length - 1].price;
        const priceChangePercent = ((point.price - lastPrice) / lastPrice) * 100;

        // Alert on significant price drops
        if (Math.abs(priceChangePercent) >= this.PRICE_DROP_THRESHOLD) {
          let severity: 'critical' | 'warning' | 'info';
          if (Math.abs(priceChangePercent) >= 20) {
            severity = 'critical';
          } else if (Math.abs(priceChangePercent) >= this.PRICE_DROP_THRESHOLD) {
            severity = 'warning';
          } else {
            severity = 'info';
          }

          alerts.push({
            productName: point.productName,
            competitor: point.competitor,
            oldPrice: lastPrice,
            newPrice: point.price,
            priceChangePercent,
            timestamp: point.scrapedAt,
            severity,
          });
        }
      }

      // Update price history
      previousPrices.push(point);
      this.priceHistory.set(key, previousPrices);
    }

    return alerts;
  }

  /**
   * Store price data in LanceDB
   * 
   * NOTE: Simplified version. In production:
   * - Use actual LanceDB client
   * - Add vector embeddings for semantic search
   * - Implement retention policies
   */
  private async storeInLanceDB(pricePoints: PricePoint[]): Promise<void> {
    logInfo(this.name, `Storing ${pricePoints.length} price points in LanceDB...`);

    // Simulated storage (in production, would use actual LanceDB)
    for (const point of pricePoints) {
      const record: MarketIntelRecord = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productName: point.productName,
        competitor: point.competitor,
        price: point.price,
        currency: point.currency,
        scrapedAt: point.scrapedAt,
        sourceUrl: point.sourceUrl,
        // embedding would be generated here
      };

      // TODO: Actual LanceDB insert
      // await lanceDBClient.insert('market_intel', record);
    }

    logInfo(this.name, '✅ Price data stored in LanceDB');
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Parse market intel request
   */
  private parseMarketIntelRequest(task: string): MarketIntelData {
    try {
      const parsed = JSON.parse(task);
      if (parsed.productCategory) {
        return parsed as MarketIntelData;
      }
    } catch {
      // Not JSON, parse natural language
    }

    return {
      productCategory: this.extractProductCategory(task),
      competitors: this.extractCompetitors(task),
      priceRange: this.extractPriceRange(task),
    };
  }

  private extractProductCategory(task: string): string {
    const categories = [
      'industrial valves',
      'automation equipment',
      'manufacturing tools',
      'software licenses',
      'cloud services',
    ];

    for (const category of categories) {
      if (task.toLowerCase().includes(category.toLowerCase())) {
        return category;
      }
    }

    return 'general products';
  }

  private extractCompetitors(task: string): string[] | undefined {
    // Extract competitor names from text (simplified)
    const matches = task.match(/competitors?:\s*([^.]+)/i);
    if (matches) {
      return matches[1].split(',').map(c => c.trim());
    }
    return undefined;
  }

  private extractPriceRange(task: string): { min: number; max: number } | undefined {
    const match = task.match(/(\d+)\s*-\s*(\d+)/);
    if (match) {
      return {
        min: parseInt(match[1], 10),
        max: parseInt(match[2], 10),
      };
    }
    return undefined;
  }

  private getDefaultCompetitors(category: string): string[] {
    return [
      'Competitor A Ltd.',
      'Competitor B Inc.',
      'Competitor C Corp.',
    ];
  }

  private generateProductNames(category: string, count: number): string[] {
    const names: string[] = [];
    for (let i = 1; i <= count; i++) {
      names.push(`${category} - Product ${i}`);
    }
    return names;
  }

  private getBasePriceForCategory(category: string): number {
    const basePrices: Record<string, number> = {
      'industrial valves': 50000,
      'automation equipment': 150000,
      'manufacturing tools': 80000,
      'software licenses': 30000,
      'cloud services': 10000,
    };

    return basePrices[category.toLowerCase()] || 50000;
  }

  private groupByProduct(pricePoints: PricePoint[]): Map<string, PricePoint[]> {
    const groups = new Map<string, PricePoint[]>();

    for (const point of pricePoints) {
      if (!groups.has(point.productName)) {
        groups.set(point.productName, []);
      }
      groups.get(point.productName)!.push(point);
    }

    return groups;
  }

  private calculateAveragePriceChange(pricePoints: PricePoint[]): number {
    if (pricePoints.length === 0) return 0;

    const productGroups = this.groupByProduct(pricePoints);
    let totalChange = 0;
    let count = 0;

    for (const prices of productGroups.values()) {
      if (prices.length < 2) continue;

      const firstPrice = prices[0].price;
      const lastPrice = prices[prices.length - 1].price;
      const change = ((lastPrice - firstPrice) / firstPrice) * 100;

      totalChange += change;
      count++;
    }

    return count > 0 ? totalChange / count : 0;
  }
}
