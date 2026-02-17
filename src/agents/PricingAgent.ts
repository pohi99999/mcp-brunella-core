import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Price Intelligence Data Point
 */
interface PriceDataPoint {
  productId: string;
  productName: string;
  source: 'auction' | 'competitor' | 'market_avg' | 'historical';
  price: number;
  currency: string;
  date: Date;
  confidence: number; // 0-100 percentage
  marketTrendDirection: 'up' | 'down' | 'stable';
  historicalComparison: { percentChange: number; timeFrame: string };
}

/**
 * Pricing Recommendation
 */
interface PricingRecommendation {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  priceAdjustmentPercent: number;
  reasoning: string;
  marketContext: {
    averageMarketPrice: number;
    competitorRange: { min: number; max: number };
    trendDirection: 'up' | 'down' | 'stable';
  };
  confidence: number; // 0-100
  suggestedAction: 'increase' | 'decrease' | 'maintain';
}

/**
 * Market Intelligence Report
 */
interface MarketIntelligenceReport {
  reportDate: Date;
  marketTrends: Array<{
    category: string;
    trend: string;
    trendDirection: 'up' | 'down' | 'stable';
    impactLevel: 'high' | 'medium' | 'low';
  }>;
  competitorAnalysis: Array<{
    competitorName: string;
    productsTracked: number;
    averagePricePoint: number;
    priceStrategy: 'premium' | 'competitive' | 'discount';
  }>;
  opportunities: string[];
  threats: string[];
  recommendations: PricingRecommendation[];
}

/**
 * PricingAgent - Dinamikus Árazó & Piaci Hírszerző
 * Responsibility: Market price tracking, competitive analysis, pricing recommendations
 * 
 * Features:
 * - Real-time auction price monitoring
 * - Competitor price tracking
 * - Historical trend analysis
 * - Dynamic pricing recommendations
 * - Market sentiment analysis
 */
export class PricingAgent implements IAgent {
  name = 'PricingAgent';
  role = 'Market Intelligence & Dynamic Pricing';
  description = 'Dinamikus Árazó & Piaci Hírszerző - Analyzes market trends, competitor pricing, generates recommendations';
  capabilities = ['market_analysis', 'competitor_tracking', 'price_optimization', 'trend_forecasting', 'sentiment_analysis'];
  
  private priceHistory: Map<string, PriceDataPoint[]> = new Map();
  private competitorData: Map<string, { name: string; prices: number[] }> = new Map();
  private marketTrends: Array<{ category: string; direction: 'up' | 'down' | 'stable' }> = [];

  /**
   * Execute market intelligence workflow
   */
  async execute(task: string, _context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    const startTime = Date.now();

    try {
      logInfo(this.name, `Starting market intelligence analysis: ${task.slice(0, 40)}`);

      // Step 1: Gather market data from multiple sources
      const marketData = await this.gatherMarketData();
      logInfo(this.name, `Gathered market data from ${marketData.sources.length} sources`);

      // Step 2: Analyze competitor pricing
      const competitorAnalysis = this.analyzeCompetitorPricing();
      logInfo(this.name, `Analyzed ${competitorAnalysis.length} competitors`);

      // Step 3: Detect market trends
      const trends = this.detectMarketTrends();
      logInfo(this.name, `Detected ${trends.length} market trends`);

      // Step 4: Generate pricing recommendations
      const recommendations = this.generatePricingRecommendations(marketData.pricePoints);
      logInfo(this.name, `Generated ${recommendations.length} pricing recommendations`);

      // Step 5: Compile intelligence report
      const report: MarketIntelligenceReport = {
        reportDate: new Date(),
        marketTrends: trends,
        competitorAnalysis: competitorAnalysis,
        opportunities: this.identifyOpportunities(trends),
        threats: this.identifyThreats(trends),
        recommendations: recommendations
      };

      logInfo(this.name, `Market intelligence report generated successfully`);

      return {
        status: 'success',
        data: report,
        metadata: {
          dataPointsAnalyzed: marketData.pricePoints.length,
          competitorsTracked: competitorAnalysis.length,
          trendsDetected: trends.length,
          recommendationsGenerated: recommendations.length,
          processingTimeMs: Date.now() - startTime
        }
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Market intelligence analysis failed: ${error}`);
      return {
        status: 'error',
        error: error,
        metadata: { dataPointsAnalyzed: this.priceHistory.size }
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Gather market data from multiple sources (mock)
   */
  private async gatherMarketData(): Promise<{
    sources: string[];
    pricePoints: PriceDataPoint[];
  }> {
    // Mock sources: auction sites, competitor websites, market databases
    const sources = ['eBay', 'Amazon', 'Competitor A', 'Competitor B', 'Market Aggregator'];
    
    // Mock price data points
    const pricePoints: PriceDataPoint[] = [
      {
        productId: 'PROD-001',
        productName: 'Premium Widget',
        source: 'auction',
        price: 4500,
        currency: 'HUF',
        date: new Date(),
        confidence: 95,
        marketTrendDirection: 'up',
        historicalComparison: { percentChange: 12, timeFrame: '30 days' }
      },
      {
        productId: 'PROD-001',
        productName: 'Premium Widget',
        source: 'competitor',
        price: 4200,
        currency: 'HUF',
        date: new Date(),
        confidence: 90,
        marketTrendDirection: 'up',
        historicalComparison: { percentChange: 8, timeFrame: '30 days' }
      },
      {
        productId: 'PROD-002',
        productName: 'Standard Widget',
        source: 'market_avg',
        price: 2800,
        currency: 'HUF',
        date: new Date(),
        confidence: 85,
        marketTrendDirection: 'stable',
        historicalComparison: { percentChange: 0, timeFrame: '30 days' }
      }
    ];

    // Store for future analysis
    pricePoints.forEach(point => {
      const existing = this.priceHistory.get(point.productId) || [];
      this.priceHistory.set(point.productId, [...existing, point]);
    });

    return { sources, pricePoints };
  }

  /**
   * Analyze competitor pricing
   */
  private analyzeCompetitorPricing(): Array<{
    competitorName: string;
    productsTracked: number;
    averagePricePoint: number;
    priceStrategy: 'premium' | 'competitive' | 'discount';
  }> {
    // Mock competitor data
    const competitors = [
      { competitorName: 'Competitor A', productsTracked: 45, averagePricePoint: 4100, priceStrategy: 'competitive' as const },
      { competitorName: 'Competitor B', productsTracked: 38, averagePricePoint: 3800, priceStrategy: 'discount' as const },
      { competitorName: 'Competitor C', productsTracked: 52, averagePricePoint: 4800, priceStrategy: 'premium' as const }
    ];

    competitors.forEach(comp => {
      this.competitorData.set(comp.competitorName, {
        name: comp.competitorName,
        prices: [comp.averagePricePoint]
      });
    });

    return competitors;
  }

  /**
   * Detect market trends
   */
  private detectMarketTrends(): Array<{
    category: string;
    trend: string;
    trendDirection: 'up' | 'down' | 'stable';
    impactLevel: 'high' | 'medium' | 'low';
  }> {
    return [
      {
        category: 'Digital Transformation',
        trend: 'Cloud-based solutions gaining market share',
        trendDirection: 'up',
        impactLevel: 'high'
      },
      {
        category: 'Supply Chain',
        trend: 'Shortage of semiconductors affecting availability',
        trendDirection: 'up',
        impactLevel: 'high'
      },
      {
        category: 'Consumer Behavior',
        trend: 'E-commerce adoption stabilizing',
        trendDirection: 'stable',
        impactLevel: 'medium'
      },
      {
        category: 'Labor Market',
        trend: 'Wage inflation continuing in tech sector',
        trendDirection: 'up',
        impactLevel: 'medium'
      }
    ];
  }

  /**
   * Generate pricing recommendations
   */
  private generatePricingRecommendations(pricePoints: PriceDataPoint[]): PricingRecommendation[] {
    return pricePoints
      .filter((p, i, arr) => arr.findIndex(x => x.productId === p.productId) === i) // Unique products
      .map(point => {
        const avgMarketPrice = this.calculateAveragePrice(point.productId);
        const competitorRange = this.getCompetitorRange(point.productId);
        const trend = point.marketTrendDirection;

        // Calculate recommended price
        let recommendedPrice = avgMarketPrice;
        if (trend === 'up') {
          recommendedPrice = avgMarketPrice * 1.05; // Increase 5% in upward trend
        } else if (trend === 'down') {
          recommendedPrice = avgMarketPrice * 0.98; // Decrease 2% in downward trend
        }

        return {
          productId: point.productId,
          currentPrice: point.price,
          recommendedPrice: Math.round(recommendedPrice),
          priceAdjustmentPercent: Math.round(((recommendedPrice - point.price) / point.price) * 100),
          reasoning: `Market average is ${avgMarketPrice} HUF. Current trend is ${trend}. Competitors priced between ${competitorRange.min}-${competitorRange.max} HUF.`,
          marketContext: {
            averageMarketPrice: avgMarketPrice,
            competitorRange: competitorRange,
            trendDirection: trend
          },
          confidence: 85,
          suggestedAction: recommendedPrice > point.price ? 'increase' : (recommendedPrice < point.price ? 'decrease' : 'maintain')
        };
      });
  }

  /**
   * Calculate average price for a product
   */
  private calculateAveragePrice(productId: string): number {
    const history = this.priceHistory.get(productId) || [];
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, p) => acc + p.price, 0);
    return Math.round(sum / history.length);
  }

  /**
   * Get competitor price range for a product
   */
  private getCompetitorRange(productId: string): { min: number; max: number } {
    // Mock implementation
    return { min: 3500, max: 5000 };
  }

  /**
   * Identify business opportunities from trends
   */
  private identifyOpportunities(trends: Array<{ category: string; trend: string; trendDirection: string }>): string[] {
    const upwardTrends = trends
      .filter(t => t.trendDirection === 'up')
      .map(t => `Leverage ${t.category} trend: ${t.trend}`);

    return [
      ...upwardTrends,
      'Expand into emerging markets showing growth',
      'Invest in automation to reduce operational costs'
    ];
  }

  /**
   * Identify market threats
   */
  private identifyThreats(trends: Array<{ category: string; trend: string; trendDirection: string }>): string[] {
    const downwardTrends = trends
      .filter(t => t.trendDirection === 'down')
      .map(t => `Monitor ${t.category} decline: ${t.trend}`);

    return [
      ...downwardTrends,
      'Increasing competitive pressure from low-cost alternatives',
      'Regulatory changes affecting market accessibility'
    ];
  }
}

/**
 * Export for registry
 */
export const createPricingAgent = (): PricingAgent => new PricingAgent();
