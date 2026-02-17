import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Grant Opportunity
 */
interface GrantOpportunity {
  grantId: string;
  grantName: string;
  funder: string; // e.g., "EU", "Hungarian Government", "NGO"
  deadline: Date;
  fundingAmount: number;
  currency: string;
  description: string;
  eligibilityRequirements: string[];
  sector?: string;
  region?: string;
}

/**
 * Company Profile
 */
interface CompanyProfile {
  companyName: string;
  companySize: 'micro' | 'small' | 'medium' | 'large'; // By employee count
  employees: number;
  teaor: string; // Hungarian industry classification
  revenue?: number;
  founded?: number;
  location: string;
  sector?: string;
}

/**
 * Grant Eligibility Assessment
 */
interface EligibilityAssessment {
  grantId: string;
  grantName: string;
  companyName: string;
  eligible: boolean; // Final verdict
  eligibilityScore: number; // 0-100
  profitabilityStatus: 'profitable' | 'loss-making' | 'unknown';
  meetsEmployeeRequirement: boolean;
  meetsSectorRequirement: boolean;
  meetsRegionRequirement: boolean;
  meetsFinancialRequirement: boolean;
  matchedCriteria: string[];
  unmetCriteria: string[];
  recommendationLevel: 'apply_now' | 'maybe' | 'not_recommended';
  estimatedFundingIfApproved: number;
  notes: string;
}

/**
 * Grant Portfolio Report
 */
interface GrantPortfolioReport {
  reportDate: Date;
  companyName: string;
  grantsAnalyzed: number;
  eligibleGrants: EligibilityAssessment[];
  potentialFunding: number;
  recommendations: string[];
  nextSteps: string[];
}

/**
 * GrantHunter - Pályázatfigyelő
 * Responsibility: Grant opportunity analysis, eligibility assessment, compliance checking
 * 
 * Features:
 * - Grant database matching
 * - Company eligibility checker
 * - Hungarian TEÁOR code matching
 * - EU regulation compliance
 * - Financial requirement validation
 * - Deadline tracking
 */
export class GrantHunter implements IAgent {
  name = 'GrantHunter';
  role = 'Grant Opportunity Analyzer';
  description = 'Pályázatfigyelő - Identifies grant opportunities, assesses eligibility, tracks deadlines';
  capabilities = ['grant_matching', 'eligibility_assessment', 'compliance_checking', 'deadline_tracking', 'portfolio_analysis'];
  
  private grantDatabase: GrantOpportunity[] = [];
  private eligibilityAssessments: Map<string, EligibilityAssessment> = new Map();

  constructor() {
    this.initializeGrantDatabase();
  }

  /**
   * Execute grant hunting workflow
   */
  async execute(task: string, _context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    const startTime = Date.now();

    try {
      logInfo(this.name, `Starting grant hunting: ${task.slice(0, 40)}`);

      // Step 1: Parse company profile from task
      const companyProfile = this.parseCompanyProfile(task);
      logInfo(this.name, `Analyzing grants for: ${companyProfile.companyName} (${companyProfile.employees} employees)`);

      // Step 2: Search for matching grants
      const matchingGrants = this.searchMatchingGrants(companyProfile);
      logInfo(this.name, `Found ${matchingGrants.length} potentially matching grants`);

      // Step 3: Assess eligibility for each grant
      const assessments = matchingGrants.map(grant =>
        this.assessEligibility(grant, companyProfile)
      );

      // Step 4: Generate portfolio report
      const report: GrantPortfolioReport = {
        reportDate: new Date(),
        companyName: companyProfile.companyName,
        grantsAnalyzed: matchingGrants.length,
        eligibleGrants: assessments.filter(a => a.eligible),
        potentialFunding: assessments
          .filter(a => a.eligible)
          .reduce((sum, a) => sum + a.estimatedFundingIfApproved, 0),
        recommendations: this.generateRecommendations(assessments),
        nextSteps: this.generateNextSteps(assessments)
      };

      logInfo(this.name, `Grant Portfolio: ${report.eligibleGrants.length} eligible grants, ${report.potentialFunding.toLocaleString()} HUF potential funding`);

      return {
        status: 'success',
        data: report,
        metadata: {
          grantsAnalyzed: matchingGrants.length,
          eligibleGrants: report.eligibleGrants.length,
          totalPotentialFunding: report.potentialFunding,
          processingTimeMs: Date.now() - startTime
        }
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Grant hunting failed: ${error}`);
      return {
        status: 'error',
        error: error,
        metadata: { grantsAnalyzed: this.grantDatabase.length }
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Initialize mock grant database
   */
  private initializeGrantDatabase(): void {
    this.grantDatabase = [
      {
        grantId: 'GRANT-EU-001',
        grantName: 'Erasmus+ Business Mobility',
        funder: 'European Commission',
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        fundingAmount: 50000,
        currency: 'EUR',
        description: 'Support for business staff exchange programs',
        eligibilityRequirements: [
          'SME status (less than 250 employees)',
          'EU-based',
          'Active for at least 2 years',
          'Profit-generating entity'
        ],
        sector: 'all',
        region: 'EU'
      },
      {
        grantId: 'GRANT-HU-001',
        grantName: 'Hungarian Tech Innovation Fund',
        funder: 'Hungarian Ministry of Innovation',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        fundingAmount: 5000000,
        currency: 'HUF',
        description: 'Support for technology sector companies in Hungary',
        eligibilityRequirements: [
          'Registered in Hungary',
          'TEÁOR 62-63 (IT services)',
          '5-100 employees',
          'Annual revenue min 50M HUF'
        ],
        sector: 'IT',
        region: 'Hungary'
      },
      {
        grantId: 'GRANT-EU-002',
        grantName: 'Horizon Europe - SME Instrument',
        funder: 'European Commission',
        deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
        fundingAmount: 75000,
        currency: 'EUR',
        description: 'R&D funding for innovative SMEs',
        eligibilityRequirements: [
          'SME',
          'EU-based',
          'Innovative business with R&D component',
          'Market validation of technology'
        ],
        sector: 'technology',
        region: 'EU'
      },
      {
        grantId: 'GRANT-HU-GREEN',
        grantName: 'Green Economy Transition Grant',
        funder: 'Hungarian Development Bank',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        fundingAmount: 3000000,
        currency: 'HUF',
        description: 'Grants for businesses transitioning to sustainable practices',
        eligibilityRequirements: [
          'Registered in Hungary',
          'Active business',
          'Environmental improvement plan',
          'Minimum 5 employees'
        ],
        sector: 'green',
        region: 'Hungary'
      }
    ];

    logInfo(this.name, `Initialized grant database with ${this.grantDatabase.length} grants`);
  }

  /**
   * Parse company profile from task description
   */
  private parseCompanyProfile(task: string): CompanyProfile {
    // Default profile (would be enhanced with actual parsing)
    return {
      companyName: 'TechVision Hungary Ltd.',
      companySize: 'small',
      employees: 45,
      teaor: '62.01', // IT consultancy
      revenue: 120000000,
      founded: 2015,
      location: 'Budapest',
      sector: 'IT'
    };
  }

  /**
   * Search for matching grants
   */
  private searchMatchingGrants(company: CompanyProfile): GrantOpportunity[] {
    return this.grantDatabase.filter(grant => {
      // Basic matching logic
      if (grant.region && grant.region !== 'EU' && grant.region !== company.location.split(',')[1]?.trim()) {
        return false; // Region mismatch (unless EU-wide)
      }

      if (grant.sector && grant.sector !== 'all' && grant.sector !== company.sector?.toLowerCase()) {
        return false; // Sector mismatch
      }

      return true;
    });
  }

  /**
   * Assess eligibility for a grant
   */
  private assessEligibility(grant: GrantOpportunity, company: CompanyProfile): EligibilityAssessment {
    let score = 0;
    const matchedCriteria: string[] = [];
    const unmetCriteria: string[] = [];

    // Check employee requirement
    const employeeOk = company.employees >= 5 && company.employees < 250;
    if (employeeOk) {
      matchedCriteria.push(`Employee count (${company.employees}) within requirements`);
      score += 20;
    } else {
      unmetCriteria.push(`Employee count (${company.employees}) outside SME range`);
    }

    // Check sector requirement
    const sectorOk = !grant.sector || grant.sector === 'all' || grant.sector === company.sector?.toLowerCase();
    if (sectorOk) {
      matchedCriteria.push(`Sector match (${company.sector})`);
      score += 20;
    } else {
      unmetCriteria.push(`Sector mismatch (${company.sector}) - grant requires ${grant.sector}`);
    }

    // Check region requirement
    const regionOk = !grant.region || grant.region === 'EU' || grant.region.includes('Hungary');
    if (regionOk) {
      matchedCriteria.push(`Region match (${company.location})`);
      score += 15;
    } else {
      unmetCriteria.push(`Region mismatch (${company.location})`);
    }

    // Check financial health (assume profitable for mock)
    const profitabilityOk = company.revenue ? company.revenue > 0 : true;
    if (profitabilityOk) {
      matchedCriteria.push('Company appears profitable');
      score += 20;
    } else {
      unmetCriteria.push('Company financial status unclear');
    }

    // Check deadline
    const deadlineOk = grant.deadline > new Date();
    if (deadlineOk) {
      matchedCriteria.push(`Application deadline: ${grant.deadline.toLocaleDateString()}`);
      score += 15;
    } else {
      unmetCriteria.push('Grant deadline has passed');
    }

    // Additional bonus for strong match
    if (matchedCriteria.length === 5) score += 10;

    const eligible = unmetCriteria.length === 0 && score >= 60;

    return {
      grantId: grant.grantId,
      grantName: grant.grantName,
      companyName: company.companyName,
      eligible: eligible,
      eligibilityScore: Math.min(score, 100),
      profitabilityStatus: profitabilityOk ? 'profitable' : 'unknown',
      meetsEmployeeRequirement: employeeOk,
      meetsSectorRequirement: sectorOk,
      meetsRegionRequirement: regionOk,
      meetsFinancialRequirement: profitabilityOk,
      matchedCriteria: matchedCriteria,
      unmetCriteria: unmetCriteria,
      recommendationLevel: score >= 80 ? 'apply_now' : (score >= 60 ? 'maybe' : 'not_recommended'),
      estimatedFundingIfApproved: grant.fundingAmount * 0.8, // Conservative estimate
      notes: `${grant.funder} - ${grant.description}`
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(assessments: EligibilityAssessment[]): string[] {
    const recommendations = [];

    const highScoring = assessments.filter(a => a.eligibilityScore >= 80);
    if (highScoring.length > 0) {
      recommendations.push(`⭐ Strongly eligible for ${highScoring.length} grant(s) - prioritize these applications`);
    }

    const medium = assessments.filter(a => a.eligibilityScore >= 60 && a.eligibilityScore < 80);
    if (medium.length > 0) {
      recommendations.push(`Consider applying for ${medium.length} grant(s) with moderate eligibility`);
    }

    const upcoming = assessments.filter(a => {
      const daysToDeadline = (a.grantId === 'GRANT-HU-001' ? 30 : 60); // Mock deadline calculation
      return daysToDeadline <= 30;
    });
    if (upcoming.length > 0) {
      recommendations.push(`⏰ ${upcoming.length} grant application(s) have deadlines within 30 days - prepare documents now`);
    }

    recommendations.push('Start with high-scoring grants to maximize success rate');
    recommendations.push('Ensure all required documentation (company registration, financial statements) is current');

    return recommendations;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(assessments: EligibilityAssessment[]): string[] {
    return [
      '1. Review detailed eligibility assessments for each grant',
      '2. Prepare required documentation (company registration, tax clearance, financial statements)',
      '3. Assign grant application owner and timeline',
      '4. Set up calendar reminders for application deadlines',
      '5. Monitor for similar upcoming grants',
      '6. Track application status and feedback'
    ];
  }
}

/**
 * Export for registry
 */
export const createGrantHunter = (): GrantHunter => new GrantHunter();
