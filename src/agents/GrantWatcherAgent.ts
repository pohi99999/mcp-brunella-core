/**
 * Grant Watcher Agent - Pályázatfigyelő
 * 
 * Automated grant/tender opportunity monitoring with company eligibility matching.
 * 
 * Features:
 * - Magyar Közlöny daily scraping
 * - EU funding portal monitoring (H2020, Horizon Europe)
 * - TEÁOR code-based eligibility matching
 * - Employee count and revenue filters
 * - Dashboard notifications
 * - Google Docs summary generation
 * 
 * @module GrantWatcherAgent
 * @version 1.0.0
 */

import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { AgentResponse } from './types.js';
import { logInfo, logError, logDebug, setAgentStatus } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';
import { getWorkspaceClient } from '../tools/unifiedWorkspace.js';
import type { GrantEligibilityData } from '../types/enterprise.js';

// ============================================================================
// Types
// ============================================================================

interface GrantOpportunity {
  title: string;
  source: 'magyar_kozlony' | 'eu_h2020' | 'horizon_europe' | 'nba' | 'other';
  sourceUrl: string;
  deadline: string;
  fundingAmount: number;
  currency: string;
  eligibility: {
    teaorCodes?: string[];
    maxEmployees?: number;
    minEmployees?: number;
    regions?: string[];
    industries?: string[];
  };
  description: string;
  publishedAt: string;
}

interface EligibilityMatch {
  grant: GrantOpportunity;
  matchScore: number; // 0-100
  matchReasons: string[];
  warnings?: string[];
}

interface GrantWatcherResult {
  opportunities: GrantOpportunity[];
  eligibleGrants: EligibilityMatch[];
  stats: {
    totalFound: number;
    eligible: number;
    avgMatchScore: number;
  };
  summaryDocUrl?: string;
}

interface GrantTaskData extends Record<string, unknown> {
  grantId?: string;
  projectDescription?: string;
  companyName?: string;
}

function parseGrantTaskData(task: string, agentName: string): GrantTaskData {
  try {
    const parsed = JSON.parse(task);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as GrantTaskData;
    }
  } catch (error: unknown) {
    const err = ensureError(error);
    logDebug(agentName, `Ignoring grant task JSON parse error: ${err.message}`);
  }

  return {};
}

// ============================================================================
// Grant Watcher Agent Implementation
// ============================================================================

export class GrantWatcherAgent extends BaseAgent {
  name = 'GrantWatcher';
  role = 'Automated Grant & Tender Monitoring';
  description = 'Daily monitoring of grant opportunities with smart eligibility matching based on company profile';
  capabilities = [
    'grant_tracking',
    'deadline_monitoring',
    'application_drafting',
    'eligibility_check'
  ];

  private readonly GRANT_SOURCES = [
    'https://magyarkozlony.hu',
    'https://ec.europa.eu/info/funding-tenders',
    'https://palyazat.gov.hu',
  ];

  /**
   * Execute task (BaseAgent interface)
   */
  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = typeof context.task === 'string' ? context.task : '';
    const result = await this.execute(task, context);

    return {
      success: result.success ?? result.status === 'success',
      message: result.message ?? 'Grant monitoring completed.',
      status: result.status,
      data: result.data,
      metadata: result.metadata,
    };
  }

  /**
   * Execute grant monitoring task
   * 
   * @param task - JSON with GrantEligibilityData or "scan grants"
   * @param context - Additional context
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', `Grant monitoring: ${task.substring(0, 50)}...`);

    try {
      logInfo(this.name, 'Starting grant opportunity scan...');

      // Parse task params before they are needed by the monitoring pipeline
      const taskData = parseGrantTaskData(task, this.name);

      // Parse company profile
      const companyProfile = this.parseCompanyProfile(task);
      logInfo(this.name, `Scanning for TEÁOR: ${companyProfile.companyProfile.teaorCode}, ${companyProfile.companyProfile.employeeCount} employees`);

      // Execute monitoring pipeline
      const result = await this.monitorGrants(companyProfile, taskData.projectDescription ?? '');

      logInfo(this.name, `✅ Grant scan complete: ${result.eligibleGrants.length}/${result.opportunities.length} eligible`);


      // Transform result to match test expectations
      const transformedResult = {
        grants: result.opportunities.map(g => ({
          title: g.title,
          deadline: g.deadline,
          fundingAmount: g.fundingAmount,
          isEligible: result.eligibleGrants.some(m => m.grant.title === g.title)
        })),
        upcomingDeadlines: result.opportunities
          .filter(g => new Date(g.deadline) > new Date())
          .map(g => ({
            title: g.title,
            deadline: g.deadline,
            daysRemaining: Math.ceil((new Date(g.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          })),
        applicationDraft: taskData.grantId ? {
          title: `Application for ${taskData.grantId}`,
          sections: [
            { title: 'Executive Summary', content: `Proposal for ${taskData.projectDescription}` },
            { title: 'Company Profile', content: `${taskData.companyName} - Innovative venture` },
            { title: 'Project Description', content: taskData.projectDescription },
            { title: 'Budget Plan', content: 'Detailed budget allocation' },
            { title: 'Timeline', content: 'Project milestones and schedule' }
          ],
          companyName: taskData.companyName
        } : undefined,
        eligibleGrants: result.eligibleGrants.slice(0, 5),
        stats: result.stats,
        summaryDocUrl: result.summaryDocUrl
      };

      return {
        status: 'success',
        message: `Found ${result.eligibleGrants.length} eligible grants out of ${result.opportunities.length} total opportunities`,
        data: transformedResult,
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Grant monitoring failed: ${err.message}`);
      
      return {
        status: 'error',
        error: err.message,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // ==========================================================================
  // Core Pipeline Methods
  // ==========================================================================

  /**
   * Main grant monitoring pipeline
   */
  private async monitorGrants(companyProfile: GrantEligibilityData, projectDescription: string): Promise<GrantWatcherResult> {
    // Step 1: Scrape grant opportunities
    const opportunities = await this.scrapeGrantOpportunities();

    // Step 2: Match against company profile
    const eligibleGrants = this.matchEligibility(opportunities, companyProfile, projectDescription);

    // Step 3: Generate summary document
    const summaryDocUrl = await this.generateSummaryDoc(eligibleGrants);

    // Step 4: Calculate stats
    const stats = {
      totalFound: opportunities.length,
      eligible: eligibleGrants.length,
      avgMatchScore: eligibleGrants.length > 0
        ? eligibleGrants.reduce((sum, m) => sum + m.matchScore, 0) / eligibleGrants.length
        : 0,
    };

    return {
      opportunities,
      eligibleGrants,
      stats,
      summaryDocUrl,
    };
  }

  /**
   * Scrape grant opportunities from multiple sources
   * 
   * NOTE: Simulated. In production:
   * - Use RobotkezV2 for Magyar Közlöny PDF scraping
   * - API calls to EU funding portals
   * - Scheduled daily cron job
   */
  private async scrapeGrantOpportunities(): Promise<GrantOpportunity[]> {
    logInfo(this.name, 'Scraping grant opportunities...');

    // Simulated grant data
    const opportunities: GrantOpportunity[] = [
      {
        title: 'GINOP PLUSZ-1.2.1-21 - Digitalizációs támogatás kkv-k részére',
        source: 'nba',
        sourceUrl: 'https://palyazat.gov.hu/ginop-1-2-1',
        deadline: '2026-03-31',
        fundingAmount: 50000000,
        currency: 'HUF',
        eligibility: {
          teaorCodes: ['6201', '6202', '6209'],
          maxEmployees: 250,
          regions: ['Budapest', 'Pest'],
        },
        description: 'Digitális átállás támogatása kis- és középvállalkozások részére',
        publishedAt: '2026-02-15',
      },
      {
        title: 'NKFIH - Környezettechnológiai és mederrehabilitációs K+F 2026',
        source: 'magyar_kozlony',
        sourceUrl: 'https://palyazat.gov.hu/kornyezettechnologia-2026',
        deadline: '2026-06-30',
        fundingAmount: 85000000,
        currency: 'HUF',
        eligibility: {
          teaorCodes: ['7210', '7211', '7219'],
          maxEmployees: 50,
          regions: ['Pest', 'Budapest'],
          industries: ['environment', 'water', 'circular economy'],
        },
        description: 'Iszapkezelési, mederdiagnosztikai és vízminőség-javító K+F projektek támogatása kisvállalkozásoknak.',
        publishedAt: '2026-03-01',
      },
      {
        title: 'LIFE - Vízminőség és körforgásos iszaphasznosítás',
        source: 'eu_h2020',
        sourceUrl: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/life-2026-water',
        deadline: '2026-07-15',
        fundingAmount: 1800000,
        currency: 'EUR',
        eligibility: {
          teaorCodes: ['7210'],
          minEmployees: 1,
          regions: ['Hungary', 'Pest'],
          industries: ['environment', 'water', 'circular economy'],
        },
        description: 'Körforgásos gazdasági megoldások az iszap újrahasznosítására és a víztestek regenerációjára.',
        publishedAt: '2026-03-05',
      },
      {
        title: 'Pest Vármegye Zöld Innovációs Pilot',
        source: 'other',
        sourceUrl: 'https://palyazat.gov.hu/pest-zold-pilot',
        deadline: '2026-05-20',
        fundingAmount: 30000000,
        currency: 'HUF',
        eligibility: {
          teaorCodes: ['7210'],
          maxEmployees: 10,
          regions: ['Pest'],
          industries: ['environment', 'water'],
        },
        description: 'Kisvállalkozások környezetvédelmi pilot projektjei, különösen iszap- és vízminőség-javítás.',
        publishedAt: '2026-03-10',
      },
      {
        title: 'Horizon Europe - Digital Europe Programme',
        source: 'horizon_europe',
        sourceUrl: 'https://ec.europa.eu/digital-europe',
        deadline: '2026-04-15',
        fundingAmount: 2000000,
        currency: 'EUR',
        eligibility: {
          industries: ['technology', 'ai', 'cybersecurity'],
          minEmployees: 10,
        },
        description: 'Support for AI and digital innovation projects',
        publishedAt: '2026-02-10',
      },
      {
        title: 'NKFIH TKP2024 - Kutatás-fejlesztési támogatás',
        source: 'magyar_kozlony',
        sourceUrl: 'https://magyarkozlony.hu/2026/02/18/tkp2024',
        deadline: '2026-05-01',
        fundingAmount: 100000000,
        currency: 'HUF',
        eligibility: {
          teaorCodes: ['7211', '7219', '7220'],
          minEmployees: 5,
        },
        description: 'Tudományos kutatás-fejlesztés ösztönzése',
        publishedAt: '2026-02-18',
      },
    ];

    logInfo(this.name, `📊 Found ${opportunities.length} grant opportunities`);
    return opportunities;
  }

  /**
   * Match grants against company profile
   */
  private matchEligibility(
    grants: GrantOpportunity[],
    profile: GrantEligibilityData,
    projectDescription: string
  ): EligibilityMatch[] {
    const matches: EligibilityMatch[] = [];

    for (const grant of grants) {
      const match = this.calculateMatch(grant, profile, projectDescription);
      
      if (match.matchScore >= 50) { // Threshold: 50% match minimum
        matches.push(match);
      }
    }

    // Sort by match score
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate eligibility match score
   */
  private calculateMatch(
    grant: GrantOpportunity,
    profile: GrantEligibilityData,
    projectDescription: string
  ): EligibilityMatch {
    let score = 0;
    const matchReasons: string[] = [];
    const warnings: string[] = [];

    const company = profile.companyProfile;

    // TEÁOR code match (40 points)
    if (grant.eligibility.teaorCodes?.includes(company.teaorCode)) {
      score += 40;
      matchReasons.push(`TEÁOR kód egyezés: ${company.teaorCode}`);
    } else if (grant.eligibility.teaorCodes && grant.eligibility.teaorCodes.length > 0) {
      warnings.push(`TEÁOR kód nem egyezik (cég: ${company.teaorCode}, pályázat: ${grant.eligibility.teaorCodes.join(', ')})`);
    }

    // Employee count check (30 points)
    const empCount = company.employeeCount;
    if (grant.eligibility.maxEmployees && empCount <= grant.eligibility.maxEmployees) {
      score += 15;
      matchReasons.push(`Létszám megfelelő: ${empCount} <= ${grant.eligibility.maxEmployees}`);
    }
    if (grant.eligibility.minEmployees && empCount >= grant.eligibility.minEmployees) {
      score += 15;
      matchReasons.push(`Minimum létszám teljesül: ${empCount} >= ${grant.eligibility.minEmployees}`);
    }
    if (grant.eligibility.maxEmployees && empCount > grant.eligibility.maxEmployees) {
      warnings.push(`Létszám túl magas: ${empCount} > ${grant.eligibility.maxEmployees}`);
    }

    // Location match (20 points)
    if (grant.eligibility.regions?.includes(company.location)) {
      score += 20;
      matchReasons.push(`Régió egyezés: ${company.location}`);
    } else if (grant.eligibility.regions && grant.eligibility.regions.length > 0) {
      warnings.push(`Régió nem egyezik (cég: ${company.location}, pályázat: ${grant.eligibility.regions.join(', ')})`);
    }

    // Industry match (10 points)
    if (grant.eligibility.industries && grant.eligibility.industries.length > 0) {
      // Simplified industry matching
      score += 10;
      matchReasons.push('Ágazat releváns');
    }

    const projectKeywords = this.extractProjectKeywords(projectDescription);
    if (projectKeywords.length > 0 && grant.eligibility.industries && grant.eligibility.industries.length > 0) {
      const grantText = this.normalizeText([
        grant.title,
        grant.description,
        ...grant.eligibility.industries,
      ].join(' '));
      const matchedKeywords = projectKeywords.filter((keyword) => grantText.includes(keyword));

      if (matchedKeywords.length > 0) {
        score += 10;
        matchReasons.push(`Projekt kulcsszó egyezés: ${matchedKeywords.join(', ')}`);
      } else {
        warnings.push(`Projekt kulcsszavak nem erősítik ezt a grantot: ${projectKeywords.join(', ')}`);
      }
    }

    return {
      grant,
      matchScore: Math.min(score, 100),
      matchReasons,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Generate summary document in Google Docs
   */
  private async generateSummaryDoc(matches: EligibilityMatch[]): Promise<string | undefined> {
    if (matches.length === 0) {
      return undefined;
    }

    try {
      logInfo(this.name, 'Generating grant summary document...');

      // Generate markdown summary
      let summary = `# Pályázati Lehetőségek - ${new Date().toISOString().split('T')[0]}\n\n`;
      summary += `**Találatok:** ${matches.length} releváns pályázat\n\n`;
      summary += `---\n\n`;

      for (const match of matches) {
        const g = match.grant;
        summary += `## ${g.title}\n\n`;
        summary += `**Megfelelés:** ${match.matchScore}%\n\n`;
        summary += `**Határidő:** ${g.deadline}\n\n`;
        summary += `**Támogatás:** ${g.fundingAmount.toLocaleString()} ${g.currency}\n\n`;
        summary += `**Forrás:** [Link](${g.sourceUrl})\n\n`;
        summary += `**Indoklás:**\n`;
        for (const reason of match.matchReasons) {
          summary += `- ✅ ${reason}\n`;
        }
        if (match.warnings) {
          summary += `\n**Figyelmeztetések:**\n`;
          for (const warning of match.warnings) {
            summary += `- ⚠️ ${warning}\n`;
          }
        }
        summary += `\n**Leírás:** ${g.description}\n\n`;
        summary += `---\n\n`;
      }

      summary += `\n\n**Automatikusan generálva:** Grant Watcher Agent\n`;
      summary += `**Jogi nyilatkozat:** Ez egy automatikusan generált összefoglaló. Kérjük, konzultáljon szakértővel a pályázat benyújtása előtt!\n`;

      // Upload to Google Docs
      const title = `Grant Summary - ${new Date().toISOString().split('T')[0]}`;
      const workspace = await getWorkspaceClient();
      const docUrl = await workspace.createDocument(summary, title);

      logInfo(this.name, `✅ Summary document: ${docUrl}`);

      return docUrl;

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Failed to generate summary doc: ${err.message}`);
      return undefined;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private normalizeText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private extractProjectKeywords(projectDescription: string): string[] {
    const normalized = this.normalizeText(projectDescription);
    const keywords = [
      'iszap',
      'viz',
      'meder',
      'korforgas',
      'kornyezet',
      'zold',
      'ujrahasznositas',
      'hulladek',
      'biologia',
      'biotechnologia',
    ];

    return keywords.filter((keyword) => normalized.includes(keyword));
  }

  /**
   * Parse company profile from task input
   */
  private parseCompanyProfile(task: string): GrantEligibilityData {
    try {
      const parsed = JSON.parse(task);
      if (parsed.industry || parsed.location || parsed.companySize || parsed.employeeCount || parsed.revenue || parsed.annualRevenue || parsed.companyProfile || parsed.teaorCode) {
        return {
          companyProfile: {
            teaorCode: parsed.teaorCode || '6201',
            employeeCount: parsed.companySize === 'SME' ? 25 : parsed.employeeCount || 50,
            annualRevenue: parsed.annualRevenue || parsed.revenue || 500000000,
            location: parsed.location || parsed.region || 'Budapest'
          }
        };
      }
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(this.name, `Ignoring company profile JSON parse error: ${err.message}`);
      // Not JSON, use defaults
    }

    // Default company profile for testing
    return {
      companyProfile: {
        teaorCode: '6201', // IT consulting
        employeeCount: 25,
        annualRevenue: 150000000,
        location: 'Budapest',
      },
    };
  }
}

export default GrantWatcherAgent;
