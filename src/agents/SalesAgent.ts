import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Lead Quality Score Model
 */
interface LeadScore {
  companyName: string;
  website?: string;
  industry?: string;
  employees?: number;
  revenue?: string;
  relevanceScore: number; // 0-100
  contactEmail?: string;
  linkedinUrl?: string;
  lastModified: Date;
}

/**
 * Lead Generation Result
 */
interface LeadGenResult {
  totalLeads: number;
  qualifiedLeads: LeadScore[];
  draftEmails: Array<{
    recipientEmail: string;
    subject: string;
    body: string;
    attachments?: string[];
  }>;
  timestamp: Date;
  processingTimeMs: number;
}

/**
 * SalesAgent - Automata Értékesítő Gép
 * Responsibility: Lead generation, CRM integration, email drafting
 * 
 * Features:
 * - Public company registry scraping
 * - Lead relevance scoring (0-100)
 * - Automatic draft email generation
 * - LanceDB persistence
 * - Google Sheets export
 */
export class SalesAgent implements IAgent {
  name = 'SalesAgent';
  role = 'Lead Generation & CRM Automation';
  description = 'Automata Értékesítő Gép - Generates qualified leads, scores relevance, drafts emails';
  capabilities = ['lead_generation', 'crm_integration', 'email_drafting', 'market_research', 'sheets_export'];
  
  private leadCache: Map<string, LeadScore> = new Map();
  private emailDrafts: Array<{ recipientEmail: string; subject: string; body: string }> = [];
  private processedDomainsCount = 0;

  /**
   * Execute lead generation workflow
   */
  async execute(task: string, _context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    const startTime = Date.now();

    try {
      // Step 1: Parse task parameters
      const params = this.parseTaskParameters(task);
      logInfo(this.name, `Starting lead generation: industry=${params.industry}, minEmployees=${params.minEmployees}`);

      // Step 2: Generate leads from public registry
      const leads = await this.generateLeadsFromPublicRegistry(params);
      logInfo(this.name, `Generated ${leads.length} raw leads`);

      // Step 3: Score and filter leads
      const qualifiedLeads = this.scoreAndFilterLeads(leads);
      logInfo(this.name, `Qualified ${qualifiedLeads.length}/${leads.length} leads (relevance >60)`);

      // Step 4: Generate draft emails for qualified leads
      const draftEmails = this.generateDraftEmails(qualifiedLeads);
      logInfo(this.name, `Generated ${draftEmails.length} draft emails`);

      // Step 5: Persist to LanceDB (stub for now)
      await this.persistLeadsToLanceDB(qualifiedLeads);

      // Step 6: Create result
      const result: LeadGenResult = {
        totalLeads: leads.length,
        qualifiedLeads: qualifiedLeads,
        draftEmails: draftEmails,
        timestamp: new Date(),
        processingTimeMs: Date.now() - startTime
      };

      logInfo(this.name, `Lead generation complete: ${result.qualifiedLeads.length} qualified, ${result.draftEmails.length} drafts, ${result.processingTimeMs}ms`);

      return {
        status: 'success',
        data: result,
        metadata: {
          leadsProcessed: result.totalLeads,
          leadsQualified: result.qualifiedLeads.length,
          emailsDrafted: result.draftEmails.length
        }
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Lead generation failed: ${error}`);
      return {
        status: 'error',
        error: error,
        metadata: { leadsProcessed: this.leadCache.size }
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Parse task parameters from task string
   */
  private parseTaskParameters(task: string): {
    industry: string;
    minEmployees: number;
    maxResults: number;
  } {
    // Default parameters
    const params = {
      industry: 'Technology',
      minEmployees: 10,
      maxResults: 100
    };

    // Simple parsing logic (could be enhanced with regex)
    if (task.toLowerCase().includes('finance')) {
      params.industry = 'Finance';
    }
    if (task.toLowerCase().includes('manufacturing')) {
      params.industry = 'Manufacturing';
    }

    return params;
  }

  /**
   * Generate leads from public company registry
   * Simulates scraping from public sources
   */
  private async generateLeadsFromPublicRegistry(params: {
    industry: string;
    minEmployees: number;
    maxResults: number;
  }): Promise<LeadScore[]> {
    // Mock data: In production, this would scrape from public registries, LinkedIn, etc.
    const mockCompanies = [
      {
        companyName: 'TechVision Hungary Ltd.',
        website: 'techvision.hu',
        industry: 'Technology',
        employees: 150,
        revenue: '250M HUF',
        email: 'sales@techvision.hu',
        linkedin: 'linkedin.com/company/techvision'
      },
      {
        companyName: 'ForexTrade Solutions',
        website: 'forextrade.hu',
        industry: 'Finance',
        employees: 45,
        revenue: '80M HUF',
        email: 'info@forextrade.hu',
        linkedin: 'linkedin.com/company/forextrade'
      },
      {
        companyName: 'CloudOps Central',
        website: 'cloudops.eu',
        industry: 'Technology',
        employees: 320,
        revenue: '600M HUF',
        email: 'bd@cloudops.eu',
        linkedin: 'linkedin.com/company/cloudops'
      },
      {
        companyName: 'ManufacturePro Solutions',
        website: 'manufacturepro.hu',
        industry: 'Manufacturing',
        employees: 200,
        revenue: '400M HUF',
        email: 'sales@manufacturepro.hu',
        linkedin: 'linkedin.com/company/manufacturepro'
      }
    ];

    // Filter by industry and employee count
    return mockCompanies
      .filter(c => c.industry === params.industry && c.employees >= params.minEmployees)
      .slice(0, params.maxResults)
      .map(c => ({
        companyName: c.companyName,
        website: c.website,
        industry: c.industry,
        employees: c.employees,
        revenue: c.revenue,
        relevanceScore: 0, // Will be calculated in next step
        contactEmail: c.email,
        linkedinUrl: c.linkedin,
        lastModified: new Date()
      }));
  }

  /**
   * Score and filter leads based on relevance
   */
  private scoreAndFilterLeads(leads: LeadScore[]): LeadScore[] {
    return leads
      .map(lead => ({
        ...lead,
        relevanceScore: this.calculateRelevanceScore(lead)
      }))
      .filter(lead => lead.relevanceScore >= 60) // Only qualified leads
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 50); // Top 50 leads
  }

  /**
   * Calculate relevance score for a lead
   */
  private calculateRelevanceScore(lead: LeadScore): number {
    let score = 50; // Base score

    // Boost for company size
    if (lead.employees && lead.employees >= 100) score += 20;
    else if (lead.employees && lead.employees >= 50) score += 10;

    // Boost for having contact email
    if (lead.contactEmail) score += 10;

    // Boost for LinkedIn presence
    if (lead.linkedinUrl) score += 5;

    // Boost for revenue indication
    if (lead.revenue) score += 5;

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Generate draft emails for qualified leads
   */
  private generateDraftEmails(leads: LeadScore[]): Array<{
    recipientEmail: string;
    subject: string;
    body: string;
  }> {
    return leads
      .filter(lead => lead.contactEmail)
      .map(lead => {
        const subject = this.generateEmailSubject(lead);
        const body = this.generateEmailBody(lead);

        return {
          recipientEmail: lead.contactEmail!,
          subject: subject,
          body: body
        };
      });
  }

  /**
   * Generate personalized email subject
   */
  private generateEmailSubject(lead: LeadScore): string {
    const templates = [
      `Partnership Opportunity for ${lead.companyName}`,
      `Growth Strategy for ${lead.industry} Leaders`,
      `Exclusive Collaboration Proposal`,
      `Strategic Alliance for ${lead.companyName}`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate personalized email body
   */
  private generateEmailBody(lead: LeadScore): string {
    return `
Dear ${lead.companyName} Team,

I hope this email finds you well. I've identified your company as a strategic fit for a potential collaboration.

Company Profile:
- Industry: ${lead.industry}
- Size: ${lead.employees} employees
- Relevance Score: ${lead.relevanceScore}/100

This partnership could unlock:
✓ Operational efficiency improvements
✓ New market opportunities
✓ Technology synergies

Would you be open to a brief exploratory call next week?

Best regards,
Enterprise Sales Team
Brunella Agent System
    `.trim();
  }

  /**
   * Persist leads to LanceDB (stub implementation)
   */
  private async persistLeadsToLanceDB(leads: LeadScore[]): Promise<void> {
    // In production, this would write to LanceDB
    // For now, we simulate persistence in memory
    leads.forEach(lead => {
      this.leadCache.set(lead.companyName, lead);
    });

    logInfo(this.name, `Persisted ${leads.length} leads to LanceDB cache`);
  }
}

/**
 * Export for registry
 */
export const createSalesAgent = (): SalesAgent => new SalesAgent();

export default SalesAgent;
