import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Invoice Data Structure
 */
interface InvoiceData {
  invoiceNumber: string;
  vendor: string;
  amount: number;
  currency: string;
  date: Date;
  dueDate?: Date;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  confidence: number; // OCR confidence 0-100
}

/**
 * Price Anomaly
 */
interface PriceAnomaly {
  vendorId: string;
  vendorName: string;
  productCategory: string;
  historicalAvgPrice: number;
  currentPrice: number;
  percentageChange: number;
  anomalyScore: number; // 0-100 (higher = more anomalous)
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
}

/**
 * Financial Trend Report
 */
interface FinancialTrendReport {
  reportDate: Date;
  totalInvoicesProcessed: number;
  totalAmount: number;
  anomaliesDetected: PriceAnomaly[];
  vendorAnalysis: Array<{
    vendorName: string;
    invoiceCount: number;
    totalSpent: number;
    avgInvoiceAmount: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
  }>;
  recommendations: string[];
  costSavingsOpportunities: Array<{
    title: string;
    estimatedSavings: number;
    priority: 'high' | 'medium' | 'low';
  }>;
}

/**
 * FinanceGuardian - Pénzügyi Őrszem
 * Responsibility: Invoice OCR, anomaly detection, financial trend analysis
 * 
 * Features:
 * - Invoice PDF extraction (mock OCR)
 * - Price anomaly detection
 * - Vendor spending analysis
 * - Cost savings recommendations
 * - LanceDB price history integration
 * - Trend forecasting
 */
export class FinanceGuardian implements IAgent {
  name = 'FinanceGuardian';
  role = 'Financial Monitoring & Anomaly Detection';
  description = 'Pénzügyi Őrszem - Processes invoices, detects anomalies, generates financial reports';
  capabilities = ['invoice_processing', 'ocr_extraction', 'anomaly_detection', 'trend_analysis', 'cost_optimization'];
  
  private invoiceHistory: Map<string, InvoiceData[]> = new Map();
  private priceBaselineByVendor: Map<string, { avgPrice: number; stdDev: number }> = new Map();
  private anomaliesDetected: PriceAnomaly[] = [];

  /**
   * Execute invoice processing workflow
   */
  async execute(task: string, _context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    const startTime = Date.now();

    try {
      logInfo(this.name, `Starting invoice processing: ${task.slice(0, 40)}`);

      // Step 1: Extract invoices from PDFs (mock OCR)
      const invoices = await this.extractInvoicesFromPDFs();
      logInfo(this.name, `Extracted ${invoices.length} invoices from PDFs`);

      // Step 2: Store in history
      await this.storeInvoiceHistory(invoices);

      // Step 3: Calculate vendor baselines
      this.calculateVendorBaselines();

      // Step 4: Detect anomalies
      const anomalies = this.detectAnomalies(invoices);
      logInfo(this.name, `Detected ${anomalies.length} price anomalies`);

      // Step 5: Analyze vendor spending patterns
      const vendorAnalysis = this.analyzeVendorSpending();

      // Step 6: Identify cost savings opportunities
      const costSavings = this.identifyCostSavings(anomalies);

      // Step 7: Generate financial report
      const report: FinancialTrendReport = {
        reportDate: new Date(),
        totalInvoicesProcessed: invoices.length,
        totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
        anomaliesDetected: anomalies,
        vendorAnalysis: vendorAnalysis,
        recommendations: this.generateRecommendations(anomalies),
        costSavingsOpportunities: costSavings
      };

      logInfo(this.name, `Financial report generated: ${anomalies.length} anomalies, ${costSavings.length} opportunities`);

      return {
        status: 'success',
        data: report,
        metadata: {
          invoicesProcessed: invoices.length,
          anomaliesDetected: anomalies.length,
          costSavingsEstimate: costSavings.reduce((sum, s) => sum + s.estimatedSavings, 0),
          processingTimeMs: Date.now() - startTime
        }
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Invoice processing failed: ${error}`);
      return {
        status: 'error',
        error: error,
        metadata: { invoicesProcessed: this.invoiceHistory.size }
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Extract invoices from PDFs (mock OCR)
   */
  private async extractInvoicesFromPDFs(): Promise<InvoiceData[]> {
    // Mock invoice data
    const mockInvoices: InvoiceData[] = [
      {
        invoiceNumber: 'INV-2024-001',
        vendor: 'TechSupply Hungary',
        amount: 125000,
        currency: 'HUF',
        date: new Date('2024-02-01'),
        dueDate: new Date('2024-02-15'),
        lineItems: [
          { description: 'Laptop', quantity: 5, unitPrice: 22000, total: 110000 },
          { description: 'Software licenses', quantity: 1, unitPrice: 15000, total: 15000 }
        ],
        confidence: 98
      },
      {
        invoiceNumber: 'INV-2024-002',
        vendor: 'OfficeWorld',
        amount: 45000,
        currency: 'HUF',
        date: new Date('2024-02-05'),
        lineItems: [
          { description: 'Office furniture', quantity: 10, unitPrice: 4500, total: 45000 }
        ],
        confidence: 95
      },
      {
        invoiceNumber: 'INV-2024-003',
        vendor: 'TechSupply Hungary',
        amount: 135000,
        currency: 'HUF',
        date: new Date('2024-02-10'),
        lineItems: [
          { description: 'Laptop', quantity: 5, unitPrice: 26000, total: 130000 },
          { description: 'Warranty', quantity: 1, unitPrice: 5000, total: 5000 }
        ],
        confidence: 96
      },
      {
        invoiceNumber: 'INV-2024-004',
        vendor: 'Utilities Inc',
        amount: 28000,
        currency: 'HUF',
        date: new Date('2024-02-12'),
        lineItems: [
          { description: 'Electricity', quantity: 1, unitPrice: 28000, total: 28000 }
        ],
        confidence: 99
      }
    ];

    return mockInvoices;
  }

  /**
   * Store invoice history in memory/LanceDB
   */
  private async storeInvoiceHistory(invoices: InvoiceData[]): Promise<void> {
    invoices.forEach(invoice => {
      const vendorKey = invoice.vendor;
      const existing = this.invoiceHistory.get(vendorKey) || [];
      this.invoiceHistory.set(vendorKey, [...existing, invoice]);
    });

    logInfo(this.name, `Stored ${invoices.length} invoices in history`);
  }

  /**
   * Calculate vendor baselines for anomaly detection
   */
  private calculateVendorBaselines(): void {
    this.invoiceHistory.forEach((invoices, vendorName) => {
      if (invoices.length === 0) return;

      const amounts = invoices.map(inv => inv.amount);
      const avgPrice = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - avgPrice, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      this.priceBaselineByVendor.set(vendorName, { avgPrice, stdDev });
    });

    logInfo(this.name, `Calculated baselines for ${this.priceBaselineByVendor.size} vendors`);
  }

  /**
   * Detect price anomalies
   */
  private detectAnomalies(invoices: InvoiceData[]): PriceAnomaly[] {
    const anomalies: PriceAnomaly[] = [];

    invoices.forEach(invoice => {
      const baseline = this.priceBaselineByVendor.get(invoice.vendor);
      if (!baseline) return;

      const zScore = (invoice.amount - baseline.avgPrice) / (baseline.stdDev || 1);
      const percentageChange = ((invoice.amount - baseline.avgPrice) / baseline.avgPrice) * 100;

      // Flag if Z-score > 2 (beyond 2 std deviations) or change > 15%
      if (Math.abs(zScore) > 2 || Math.abs(percentageChange) > 15) {
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (Math.abs(zScore) > 3) severity = 'critical';
        else if (Math.abs(zScore) > 2.5) severity = 'high';
        else if (Math.abs(zScore) > 2) severity = 'medium';

        const anomaly: PriceAnomaly = {
          vendorId: invoice.vendor,
          vendorName: invoice.vendor,
          productCategory: invoice.lineItems[0]?.description || 'Unknown',
          historicalAvgPrice: baseline.avgPrice,
          currentPrice: invoice.amount,
          percentageChange: Math.round(percentageChange * 100) / 100,
          anomalyScore: Math.min(Math.abs(zScore) * 20, 100), // Scale to 0-100
          severity: severity,
          reasoning: `Invoice ${invoice.invoiceNumber}: ${percentageChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(percentageChange).toFixed(1)}% vs historical average of ${baseline.avgPrice} HUF`
        };

        anomalies.push(anomaly);
      }
    });

    this.anomaliesDetected = anomalies;
    return anomalies;
  }

  /**
   * Analyze vendor spending patterns
   */
  private analyzeVendorSpending(): Array<{
    vendorName: string;
    invoiceCount: number;
    totalSpent: number;
    avgInvoiceAmount: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
  }> {
    return Array.from(this.invoiceHistory.entries()).map(([vendorName, invoices]) => {
      const totalSpent = invoices.reduce((sum, inv) => sum + inv.amount, 0);
      const avgAmount = totalSpent / invoices.length;

      // Simple trend: compare first half vs second half
      const midpoint = Math.floor(invoices.length / 2);
      const firstHalfAvg = invoices.slice(0, midpoint).reduce((sum, inv) => sum + inv.amount, 0) / midpoint || 0;
      const secondHalfAvg = invoices.slice(midpoint).reduce((sum, inv) => sum + inv.amount, 0) / (invoices.length - midpoint) || 0;

      let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
      const trendChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      if (trendChange > 5) trendDirection = 'increasing';
      else if (trendChange < -5) trendDirection = 'decreasing';

      return {
        vendorName,
        invoiceCount: invoices.length,
        totalSpent: Math.round(totalSpent),
        avgInvoiceAmount: Math.round(avgAmount),
        trendDirection
      };
    });
  }

  /**
   * Identify cost savings opportunities
   */
  private identifyCostSavings(anomalies: PriceAnomaly[]): Array<{
    title: string;
    estimatedSavings: number;
    priority: 'high' | 'medium' | 'low';
  }> {
    const opportunities: Array<{ title: string; estimatedSavings: number; priority: 'high' | 'medium' | 'low' }> = [];

    // Opportunity 1: Price anomalies for renegotiation
    const highAnomalies = anomalies.filter(a => a.severity === 'high' || a.severity === 'critical');
    if (highAnomalies.length > 0) {
      const totalOverpayment = highAnomalies.reduce((sum, a) => {
        const excess = a.currentPrice - a.historicalAvgPrice;
        return sum + (excess > 0 ? excess : 0);
      }, 0);

      opportunities.push({
        title: `Renegotiate pricing with ${highAnomalies.length} vendor(s) showing price spikes`,
        estimatedSavings: Math.round(totalOverpayment),
        priority: 'high'
      });
    }

    // Opportunity 2: Volume discounts for frequent vendors
    const frequentVendors = Array.from(this.invoiceHistory.entries())
      .filter(([, invoices]) => invoices.length >= 3)
      .map(([name, invoices]) => ({
        name,
        count: invoices.length,
        totalSpent: invoices.reduce((sum, inv) => sum + inv.amount, 0)
      }));

    if (frequentVendors.length > 0) {
      opportunities.push({
        title: `Negotiate volume discounts with ${frequentVendors.length} frequent supplier(s)`,
        estimatedSavings: Math.round(frequentVendors.reduce((sum, v) => sum + (v.totalSpent * 0.05), 0)), // 5% potential savings
        priority: 'medium'
      });
    }

    // Opportunity 3: Consolidate vendors
    if (this.invoiceHistory.size > 3) {
      opportunities.push({
        title: `Consolidate vendors - currently working with ${this.invoiceHistory.size} suppliers`,
        estimatedSavings: Math.round(Array.from(this.invoiceHistory.values())
          .reduce((sum, invoices) => sum + invoices.reduce((invSum, inv) => invSum + inv.amount, 0), 0) * 0.03), // 3% potential savings
        priority: 'medium'
      });
    }

    return opportunities;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(anomalies: PriceAnomaly[]): string[] {
    const recommendations = [];

    if (anomalies.length > 0) {
      recommendations.push(`Review and address ${anomalies.length} detected price anomalies`);
      const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
      if (criticalCount > 0) {
        recommendations.push(`⚠️ URGENT: ${criticalCount} critical pricing anomalies require immediate review`);
      }
    }

    if (this.invoiceHistory.size > 0) {
      recommendations.push('Establish vendor performance metrics and SLAs');
      recommendations.push('Implement automated invoice validation to reduce manual processing');
      recommendations.push('Regular price benchmarking against market rates');
    }

    recommendations.push('Implement 3-way matching (PO, Invoice, Receiving) to catch discrepancies early');

    return recommendations;
  }
}

/**
 * Export for registry
 */
export const createFinanceGuardian = (): FinanceGuardian => new FinanceGuardian();

export default FinanceGuardian;
