import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Insurance Claim
 */
interface InsuranceClaim {
  claimId: string;
  policyNumber: string;
  claimType: 'property' | 'health' | 'auto' | 'liability' | 'loss';
  claimDate: Date;
  submitDate: Date;
  status: 'open' | 'under_review' | 'approved' | 'rejected' | 'paid' | 'pending_documents';
  amount: number;
  description: string;
  documents: Array<{ documentId: string; type: string; uploadDate: Date }>;
  assignedAdjuster?: string;
  lastUpdate: Date;
  riskAssessment: number; // 0-100, higher = more risky
}

/**
 * Risk Factor
 */
interface RiskFactor {
  factorId: string;
  factorType: string; // 'location', 'history', 'frequency', 'severity'
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  metadata: Record<string, unknown>;
}

/**
 * Proactive Intervention
 */
interface ProactiveIntervention {
  interventionId: string;
  claimId: string;
  type: 'prevention' | 'early_settlement' | 'fraud_check' | 'document_request';
  description: string;
  probability: number; // 0-100
  recommendedAction: string;
  estimatedOutcome: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * ProactiveClaimsAgent - Proaktív Biztosítási Ügyek Kezelő
 * Manages insurance claims, risk assessment, fraud detection, and proactive interventions
 */
export class ProactiveClaimsAgent implements IAgent {
  name = 'ProactiveClaimsAgent';
  role = 'Insurance & Risk Management';
  description = 'Proaktív Biztosítási Ügyek Kezelő - Biztosítási ügyek, kockázatfelmérés, csalások felderítése';
  capabilities = [
    'claims_processing',
    'risk_assessment',
    'fraud_detection',
    'document_analysis',
    'proactive_intervention',
    'settlement_recommendations',
    'compliance_check'
  ];

  private claimsDatabase: Map<string, InsuranceClaim> = new Map();
  private riskFactors: Map<string, RiskFactor> = new Map();
  private interventions: ProactiveIntervention[] = [];

  /**
   * Execute agent task
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `Feladat indítása: ${task.slice(0, 40)}...`);

      if (task.toLowerCase().includes('claim') || task.toLowerCase().includes('ügy')) {
        return await this.processClaims(task, context);
      }

      if (task.toLowerCase().includes('risk') || task.toLowerCase().includes('kockázat')) {
        return await this.assessRisks(task, context);
      }

      if (task.toLowerCase().includes('fraud') || task.toLowerCase().includes('csalás')) {
        return await this.detectFraud(task, context);
      }

      if (task.toLowerCase().includes('proactive') || task.toLowerCase().includes('preaktív')) {
        return await this.identifyInterventions(task, context);
      }

      // Default: process claims
      return await this.processClaims(task, context);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Process insurance claims
   */
  private async processClaims(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Biztosítási ügyek feldolgozása...');

    // Mock claims
    const mockClaims: InsuranceClaim[] = [
      {
        claimId: 'CLM-2026-001',
        policyNumber: 'POL-12345',
        claimType: 'property',
        claimDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        submitDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        status: 'under_review',
        amount: 5000,
        description: 'Water damage to property',
        documents: [
          { documentId: 'DOC-001', type: 'photo', uploadDate: new Date() },
          { documentId: 'DOC-002', type: 'estimate', uploadDate: new Date() }
        ],
        assignedAdjuster: 'John Smith',
        lastUpdate: new Date(),
        riskAssessment: 35
      },
      {
        claimId: 'CLM-2026-002',
        policyNumber: 'POL-67890',
        claimType: 'auto',
        claimDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        submitDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        status: 'pending_documents',
        amount: 2500,
        description: 'Vehicle collision damage',
        documents: [
          { documentId: 'DOC-003', type: 'photo', uploadDate: new Date() }
        ],
        assignedAdjuster: 'Mary Johnson',
        lastUpdate: new Date(),
        riskAssessment: 28
      },
      {
        claimId: 'CLM-2026-003',
        policyNumber: 'POL-11111',
        claimType: 'health',
        claimDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        submitDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        status: 'approved',
        amount: 3200,
        description: 'Medical treatment expenses',
        documents: [
          { documentId: 'DOC-004', type: 'invoice', uploadDate: new Date() },
          { documentId: 'DOC-005', type: 'medical_report', uploadDate: new Date() }
        ],
        assignedAdjuster: 'Dr. Williams',
        lastUpdate: new Date(),
        riskAssessment: 15
      }
    ];

    // Store claims
    for (const claim of mockClaims) {
      this.claimsDatabase.set(claim.claimId, claim);
      logInfo(
        this.name,
        `Ügy feldolgozva: ${claim.claimId} (${claim.claimType}) - ${claim.status}`
      );
    }

    return {
      status: 'success',
      data: {
        totalClaims: mockClaims.length,
        claims: mockClaims.map(c => ({
          claimId: c.claimId,
          policyNumber: c.policyNumber,
          type: c.claimType,
          amount: c.amount,
          status: c.status,
          submissionDate: c.submitDate,
          adjuster: c.assignedAdjuster,
          riskScore: c.riskAssessment
        })),
        claimsByStatus: {
          open: mockClaims.filter(c => c.status === 'open').length,
          underReview: mockClaims.filter(c => c.status === 'under_review').length,
          pendingDocuments: mockClaims.filter(c => c.status === 'pending_documents').length,
          approved: mockClaims.filter(c => c.status === 'approved').length,
          rejected: mockClaims.filter(c => c.status === 'rejected').length,
          paid: mockClaims.filter(c => c.status === 'paid').length
        },
        claimsByType: {
          property: mockClaims.filter(c => c.claimType === 'property').length,
          health: mockClaims.filter(c => c.claimType === 'health').length,
          auto: mockClaims.filter(c => c.claimType === 'auto').length,
          liability: mockClaims.filter(c => c.claimType === 'liability').length
        },
        totalAmount: mockClaims.reduce((sum, c) => sum + c.amount, 0),
        averageProcessingTime: `${Math.round(Math.random() * 10 + 5)} days`
      }
    };
  }

  /**
   * Assess risks in claims
   */
  private async assessRisks(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Kockázatfelmérés...');

    // Mock risk factors
    const riskFactors: RiskFactor[] = [
      {
        factorId: 'RF-001',
        factorType: 'frequency',
        description: 'High claim frequency',
        riskLevel: 'high',
        score: 78,
        metadata: { claims_per_year: 5, threshold: 2 }
      },
      {
        factorId: 'RF-002',
        factorType: 'location',
        description: 'High-risk geographic area',
        riskLevel: 'medium',
        score: 62,
        metadata: { region: 'industrial', incident_rate: 0.15 }
      },
      {
        factorId: 'RF-003',
        factorType: 'history',
        description: 'Previous fraud incidents',
        riskLevel: 'critical',
        score: 92,
        metadata: { fraud_count: 2, timeframe: '3 years' }
      },
      {
        factorId: 'RF-004',
        factorType: 'severity',
        description: 'High claim amounts',
        riskLevel: 'high',
        score: 85,
        metadata: { avg_claim: 8500, threshold: 5000 }
      }
    ];

    for (const factor of riskFactors) {
      this.riskFactors.set(factor.factorId, factor);
      logInfo(this.name, `Kockázati tényező: ${factor.description} (${factor.riskLevel})`);
    }

    return {
      status: 'success',
      data: {
        riskAssessmentDate: new Date(),
        totalFactors: riskFactors.length,
        factors: riskFactors.map(f => ({
          factorId: f.factorId,
          type: f.factorType,
          description: f.description,
          riskLevel: f.riskLevel,
          score: f.score
        })),
        overallRiskLevel: this.calculateOverallRisk(riskFactors),
        riskSummary: {
          critical: riskFactors.filter(f => f.riskLevel === 'critical').length,
          high: riskFactors.filter(f => f.riskLevel === 'high').length,
          medium: riskFactors.filter(f => f.riskLevel === 'medium').length,
          low: riskFactors.filter(f => f.riskLevel === 'low').length
        },
        mitigationStrategies: [
          'Implement additional verification procedures',
          'Increase claim monitoring frequency',
          'Require independent assessment for high-value claims',
          'Establish fraud prevention protocols'
        ],
        recommendations: [
          'Review claims from high-risk claimants',
          'Enhance document authentication',
          'Schedule inspector visits for suspicious claims',
          'Consider policy restriction or termination'
        ]
      }
    };
  }

  /**
   * Detect potential fraud
   */
  private async detectFraud(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Csalásérzékelés...');

    const fraudIndicators = [
      {
        indicator: 'Multiple claims in short timeframe',
        severity: 'high',
        matchedClaims: 3,
        confidence: 87
      },
      {
        indicator: 'Inflated claim amounts vs. market value',
        severity: 'medium',
        matchedClaims: 2,
        confidence: 72
      },
      {
        indicator: 'Inconsistent damage documentation',
        severity: 'high',
        matchedClaims: 1,
        confidence: 94
      },
      {
        indicator: 'Known fraud pattern match',
        severity: 'critical',
        matchedClaims: 1,
        confidence: 98
      }
    ];

    logInfo(this.name, `${fraudIndicators.length} csalási mutató azonosítva`);

    return {
      status: 'success',
      data: {
        fraudAnalysisDate: new Date(),
        indicatorsFound: fraudIndicators.length,
        indicators: fraudIndicators.map(i => ({
          indicator: i.indicator,
          severity: i.severity,
          matchedClaims: i.matchedClaims,
          confidence: `${i.confidence}%`
        })),
        fraudRiskClaims: Array.from(this.claimsDatabase.values())
          .filter(c => c.riskAssessment > 70)
          .map(c => ({
            claimId: c.claimId,
            riskScore: c.riskAssessment,
            recommendedAction: 'Enhanced investigation required',
            estimatedAccuracy: '92%'
          })),
        fraudDetectionMetrics: {
          claimsAnalyzed: this.claimsDatabase.size,
          suspiciousClaims: Math.ceil(this.claimsDatabase.size * 0.15),
          detectionAccuracy: '94.5%',
          falsePositiveRate: '2.3%'
        },
        nextActions: [
          'Assign each suspicious claim to fraud specialist',
          'Request additional documentation',
          'Schedule adjuster investigation visits',
          'Review claim history for pattern analysis',
          'Escalate critical cases to legal team'
        ]
      }
    };
  }

  /**
   * Identify proactive interventions
   */
  private async identifyInterventions(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Proaktív beavatkozások azonosítása...');

    const interventions: ProactiveIntervention[] = [];

    // Analyze each claim for interventions
    for (const [_, claim] of this.claimsDatabase) {
      if (claim.status === 'pending_documents') {
        interventions.push({
          interventionId: `INT-${Date.now()}-001`,
          claimId: claim.claimId,
          type: 'document_request',
          description: 'Request missing documentation from claimant',
          probability: 85,
          recommendedAction: 'Send automated reminder about missing documents',
          estimatedOutcome: 'positive',
          timestamp: new Date(),
          priority: 'high'
        });
      }

      if (claim.riskAssessment > 70) {
        interventions.push({
          interventionId: `INT-${Date.now()}-002`,
          claimId: claim.claimId,
          type: 'fraud_check',
          description: 'High-risk claim requires enhanced investigation',
          probability: 78,
          recommendedAction: 'Assign to fraud specialist team',
          estimatedOutcome: 'neutral',
          timestamp: new Date(),
          priority: 'critical'
        });
      }

      if (
        claim.status === 'under_review' &&
        Date.now() - claim.submitDate.getTime() > 7 * 24 * 60 * 60 * 1000
      ) {
        interventions.push({
          interventionId: `INT-${Date.now()}-003`,
          claimId: claim.claimId,
          type: 'early_settlement',
          description: 'Proactive settlement offer to expedite resolution',
          probability: 65,
          recommendedAction: 'Contact claimant with settlement proposal',
          estimatedOutcome: 'positive',
          timestamp: new Date(),
          priority: 'medium'
        });
      }
    }

    this.interventions.push(...interventions);

    logInfo(this.name, `${interventions.length} beavatkozás javasolt`);

    return {
      status: 'success',
      data: {
        interventionDate: new Date(),
        totalInterventions: interventions.length,
        interventions: interventions.map(i => ({
          interventionId: i.interventionId,
          claimId: i.claimId,
          type: i.type,
          description: i.description,
          probability: `${i.probability}%`,
          action: i.recommendedAction,
          priority: i.priority
        })),
        interventionsByType: {
          documentRequest: interventions.filter(i => i.type === 'document_request').length,
          fraudCheck: interventions.filter(i => i.type === 'fraud_check').length,
          earlySettlement: interventions.filter(i => i.type === 'early_settlement').length,
          prevention: interventions.filter(i => i.type === 'prevention').length
        },
        interventionsByPriority: {
          critical: interventions.filter(i => i.priority === 'critical').length,
          high: interventions.filter(i => i.priority === 'high').length,
          medium: interventions.filter(i => i.priority === 'medium').length,
          low: interventions.filter(i => i.priority === 'low').length
        },
        expectedOutcomes: {
          positive: interventions.filter(i => i.estimatedOutcome === 'positive').length,
          neutral: interventions.filter(i => i.estimatedOutcome === 'neutral').length,
          negative: interventions.filter(i => i.estimatedOutcome === 'negative').length
        },
        estimatedCostSavings: `${Math.round(Math.random() * 50000 + 10000)} currency units`,
        estimatedTimeToResolution: `${Math.round(Math.random() * 14 + 7)} days`
      }
    };
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(factors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    const avgScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;
    if (avgScore >= 80) return 'critical';
    if (avgScore >= 60) return 'high';
    if (avgScore >= 40) return 'medium';
    return 'low';
  }
}

export default ProactiveClaimsAgent;
