import { logInfo, logError } from '../utils/logger.js';

/**
 * Negotiation Context
 */
export interface NegotiationContext {
  productId: string;
  productName: string;
  sellerName: string;
  buyerName: string;
  currentPrice: number;
  targetPrice: number;
  historicalDealPrice?: number;
  marketAvgPrice?: number;
  urgencyLevel: 'low' | 'medium' | 'high'; // How urgent is the negotiation
  dealStage: 'initial_contact' | 'offer_sent' | 'counteroffer' | 'final';
}

/**
 * Negotiation Strategy
 */
interface NegotiationStrategy {
  strategy: 'aggressive' | 'balanced' | 'conservative';
  suggestedDiscountPercent: number;
  reasoningPoints: string[];
  emailTone: 'formal' | 'casual' | 'warm';
}

/**
 * Negotiation Email Draft
 */
export interface NegotiationEmailDraft {
  recipientEmail: string;
  senderName: string;
  subject: string;
  body: string;
  suggestedPrice: number;
  strategyUsed: string;
  confidence: number; // 0-100
}

/**
 * Negotiation Engine - Automata Ártárgyaló
 * Generates negotiation strategies and draft emails for procurement/sales negotiations
 */
class NegotiationEngine {
  /**
   * Define negotiation tool metadata
   */
  static toolDefinition = {
    name: 'negotiation_engine',
    description: 'Automata Ártárgyaló - Generates pricing negotiation strategies and draft emails',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Unique product identifier' },
        productName: { type: 'string', description: 'Name of the product being negotiated' },
        sellerName: { type: 'string', description: 'Name of the seller/supplier' },
        buyerName: { type: 'string', description: 'Name of the buyer/company' },
        currentPrice: { type: 'number', description: 'Current asking price' },
        targetPrice: { type: 'number', description: 'Target price for negotiation' },
        historicalDealPrice: { type: 'number', description: 'Previous deal price (optional)' },
        marketAvgPrice: { type: 'number', description: 'Average market price (optional)' },
        urgencyLevel: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Negotiation urgency' },
        dealStage: { 
          type: 'string', 
          enum: ['initial_contact', 'offer_sent', 'counteroffer', 'final'],
          description: 'Current stage of negotiation'
        }
      },
      required: ['productId', 'productName', 'sellerName', 'buyerName', 'currentPrice', 'targetPrice', 'urgencyLevel', 'dealStage']
    }
  };

  /**
   * Generate negotiation email draft
   */
  static generateNegotiationEmail(context: NegotiationContext): NegotiationEmailDraft {
    logInfo('NegotiationEngine', `Generating negotiation email for ${context.productName}`);

    // Step 1: Determine negotiation strategy
    const strategy = this.determineStrategy(context);

    // Step 2: Calculate suggested price
    const suggestedPrice = this.calculateSuggestedPrice(context, strategy);

    // Step 3: Generate email draft
    const email = this.generateEmail(context, strategy, suggestedPrice);

    logInfo('NegotiationEngine', `Generated negotiation email: ${email.subject}`);

    return {
      recipientEmail: `${context.sellerName.toLowerCase().replace(/\s+/g, '.')}@company.com`,
      senderName: context.buyerName,
      subject: email.subject,
      body: email.body,
      suggestedPrice: suggestedPrice,
      strategyUsed: strategy.strategy,
      confidence: this.calculateConfidence(context, strategy)
    };
  }

  /**
   * Determine negotiation strategy based on context
   */
  private static determineStrategy(context: NegotiationContext): NegotiationStrategy {
    const priceGap = context.currentPrice - context.targetPrice;
    const priceGapPercent = (priceGap / context.currentPrice) * 100;

    // Aggressive strategy: Large gap, high urgency
    if (priceGapPercent > 20 || context.urgencyLevel === 'low') {
      return {
        strategy: 'aggressive',
        suggestedDiscountPercent: Math.min(priceGapPercent, 25),
        reasoningPoints: this.generateReasoningPoints(context, 'aggressive'),
        emailTone: 'formal'
      };
    }

    // Balanced strategy: Moderate gap, medium urgency
    if (priceGapPercent > 10 || context.urgencyLevel === 'medium') {
      return {
        strategy: 'balanced',
        suggestedDiscountPercent: Math.min(priceGapPercent, 15),
        reasoningPoints: this.generateReasoningPoints(context, 'balanced'),
        emailTone: 'warm'
      };
    }

    // Conservative strategy: Small gap, high urgency
    return {
      strategy: 'conservative',
      suggestedDiscountPercent: Math.min(priceGapPercent, 8),
      reasoningPoints: this.generateReasoningPoints(context, 'conservative'),
      emailTone: 'warm'
    };
  }

  /**
   * Generate reasoning points for the negotiation
   */
  private static generateReasoningPoints(context: NegotiationContext, strategy: string): string[] {
    const points: string[] = [];

    // Market comparison reasoning
    if (context.marketAvgPrice && context.currentPrice > context.marketAvgPrice) {
      points.push(`Market average for ${context.productName} is ${context.marketAvgPrice} HUF`);
    }

    // Historical pricing reasoning
    if (context.historicalDealPrice && context.currentPrice > context.historicalDealPrice) {
      const priceIncrease = ((context.currentPrice - context.historicalDealPrice) / context.historicalDealPrice) * 100;
      points.push(`Your previous quote was ${context.historicalDealPrice} HUF (${priceIncrease.toFixed(1)}% increase)`);
    }

    // Volume commitment reasoning
    points.push('We are looking for a long-term partnership with regular orders');

    // Competitive alternatives
    points.push('We have received competitive quotes from alternative suppliers');

    // Early payment terms
    if (strategy === 'balanced' || strategy === 'conservative') {
      points.push('We can offer early payment (10 days) for additional discount');
    }

    return points;
  }

  /**
   * Calculate suggested price based on strategy
   */
  private static calculateSuggestedPrice(context: NegotiationContext, strategy: NegotiationStrategy): number {
    const discount = (context.currentPrice * strategy.suggestedDiscountPercent) / 100;
    const suggestedPrice = context.currentPrice - discount;
    return Math.round(suggestedPrice);
  }

  /**
   * Generate email draft based on strategy
   */
  private static generateEmail(
    context: NegotiationContext,
    strategy: NegotiationStrategy,
    suggestedPrice: number
  ): { subject: string; body: string } {
    const templates = {
      aggressive: {
        subject: `Pricing Review Request - ${context.productName}`,
        body: this.generateAggressiveEmailBody(context, strategy, suggestedPrice)
      },
      balanced: {
        subject: `Partnership Opportunity - ${context.productName} Quote`,
        body: this.generateBalancedEmailBody(context, strategy, suggestedPrice)
      },
      conservative: {
        subject: `Follow-up: ${context.productName} Opportunity`,
        body: this.generateConservativeEmailBody(context, strategy, suggestedPrice)
      }
    };

    return templates[strategy.strategy];
  }

  /**
   * Generate aggressive negotiation email body
   */
  private static generateAggressiveEmailBody(
    context: NegotiationContext,
    strategy: NegotiationStrategy,
    suggestedPrice: number
  ): string {
    return `
Dear ${context.sellerName},

Thank you for your quote of ${context.currentPrice} HUF for ${context.productName}.

We are very interested in this product and would like to explore a long-term partnership. However, we have received competitive quotes at significantly lower price points:

${strategy.reasoningPoints.map(p => `• ${p}`).join('\n')}

Based on our market analysis, we believe a fair price point for ${context.productName} would be ${suggestedPrice} HUF.

We are committed to a long-term relationship and can guarantee regular orders if we can align on pricing.

Could you please review your quote and get back to us by [DATE]?

Thank you for your consideration.

Best regards,
${context.buyerName}
    `.trim();
  }

  /**
   * Generate balanced negotiation email body
   */
  private static generateBalancedEmailBody(
    context: NegotiationContext,
    strategy: NegotiationStrategy,
    suggestedPrice: number
  ): string {
    return `
Dear ${context.sellerName},

Thank you for your quote. We appreciate the quality of your products and would like to move forward.

Before we finalize the order, I wanted to discuss the pricing:

${strategy.reasoningPoints.map(p => `• ${p}`).join('\n')}

We believe a price of ${suggestedPrice} HUF would be fair for both parties and allow us to establish a strong partnership.

Additionally, as a small incentive, we can offer:
- Early payment (10 days) for an additional 2% discount
- Quarterly volume commitment of at least 100 units

Would you be open to discussing this further? I'm available for a call this week.

Looking forward to your response.

Best regards,
${context.buyerName}
    `.trim();
  }

  /**
   * Generate conservative negotiation email body
   */
  private static generateConservativeEmailBody(
    context: NegotiationContext,
    strategy: NegotiationStrategy,
    suggestedPrice: number
  ): string {
    return `
Dear ${context.sellerName},

Thank you for your prompt quote for ${context.productName}. We are impressed with the product quality.

We would like to move forward with this order, and I wanted to reach out regarding the pricing:

${strategy.reasoningPoints.map(p => `• ${p}`).join('\n')}

Based on our budget constraints and market analysis, we would like to propose a price of ${suggestedPrice} HUF.

We are committed to a long-term partnership and believe this price point will create a win-win situation for both organizations.

Please let me know if this is something we can work with. I'm happy to connect for a brief conversation.

Thank you,
${context.buyerName}
    `.trim();
  }

  /**
   * Calculate confidence score for the negotiation
   */
  private static calculateConfidence(context: NegotiationContext, strategy: NegotiationStrategy): number {
    let confidence = 60; // Base confidence

    // Higher confidence if market data available
    if (context.marketAvgPrice) confidence += 15;

    // Higher confidence if historical data available
    if (context.historicalDealPrice) confidence += 15;

    // Lower confidence for final stage (less room to negotiate)
    if (context.dealStage === 'final') confidence -= 10;

    // Higher confidence for early stages
    if (context.dealStage === 'initial_contact') confidence += 10;

    return Math.min(confidence, 100);
  }

  /**
   * Generate bulk negotiation emails for multiple products
   */
  static generateBulkNegotiationEmails(
    contexts: NegotiationContext[]
  ): NegotiationEmailDraft[] {
    return contexts.map(context => {
      try {
        return this.generateNegotiationEmail(context);
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        logError('NegotiationEngine', `Failed to generate email for ${context.productName}: ${error}`);
        throw e;
      }
    });
  }
}

/**
 * Handler for negotiation_engine tool
 */
export async function negotiationEngineHandler(params: {
  productId: string;
  productName: string;
  sellerName: string;
  buyerName: string;
  currentPrice: number;
  targetPrice: number;
  historicalDealPrice?: number;
  marketAvgPrice?: number;
  urgencyLevel: 'low' | 'medium' | 'high';
  dealStage: 'initial_contact' | 'offer_sent' | 'counteroffer' | 'final';
  bulkContexts?: NegotiationContext[];
}): Promise<{
  success: boolean;
  data?: NegotiationEmailDraft | NegotiationEmailDraft[];
  error?: string;
}> {
  try {
    // Handle bulk negotiation if specified
    if (params.bulkContexts) {
      const emails = NegotiationEngine.generateBulkNegotiationEmails(params.bulkContexts);
      return { success: true, data: emails };
    }

    // Single negotiation case
    const context: NegotiationContext = {
      productId: params.productId,
      productName: params.productName,
      sellerName: params.sellerName,
      buyerName: params.buyerName,
      currentPrice: params.currentPrice,
      targetPrice: params.targetPrice,
      historicalDealPrice: params.historicalDealPrice,
      marketAvgPrice: params.marketAvgPrice,
      urgencyLevel: params.urgencyLevel,
      dealStage: params.dealStage
    };

    const emailDraft = NegotiationEngine.generateNegotiationEmail(context);
    return { success: true, data: emailDraft };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('negotiationEngineHandler', error);
    return { success: false, error: error };
  }
}

export default NegotiationEngine;
