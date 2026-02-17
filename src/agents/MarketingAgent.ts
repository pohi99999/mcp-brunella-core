import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { googleWorkspaceHandler } from '../tools/unifiedGoogleWorkspaceTool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPORATE_HUNTER = path.resolve(__dirname, "../../myai/tasks/corporate_hunter.py");

/**
 * Company Lead from Corporate Hunter
 */
interface CompanyLead {
  company_name: string;
  industry: string;
  location: string;
  employee_count?: number;
  revenue_estimate?: string;
  website?: string;
  linkedin_url?: string;
  decision_makers: DecisionMaker[];
  relevance_score: number;
  notes?: string;
  source: string;
}

interface DecisionMaker {
  name: string;
  title: string;
  email?: string;
  linkedin_url?: string;
  phone?: string;
}

/**
 * Teaser Email Template
 */
interface TeaserEmail {
  to: string[];
  subject: string;
  body: string;
  language: 'hu' | 'en' | 'de';
  companyName: string;
  personalizations: {
    decisionMakerName?: string;
    companySpecificNote?: string;
  };
}

/**
 * MarketingAgent - Real Estate Phase 4
 * Generates personalized teaser emails for corporate leads
 */
export class MarketingAgent implements IAgent {
  name = 'MarketingAgent';
  role = 'Lead Outreach & Email Marketing';
  description = 'Teaser email generátor céges leadek számára - Személyre szabott outreach kampányok';
  capabilities = [
    'corporate_lead_hunting',
    'teaser_email_generation',
    'personalization',
    'multi_language_support',
    'crm_integration'
  ];

  /**
   * Call corporate_hunter.py Python worker
   */
  private callCorporateHunter(filters: Record<string, unknown>, mock = true): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = ['--mock'];
      if (filters.industry) args.push('--industry', String(filters.industry));
      if (filters.location) args.push('--location', String(filters.location));
      if (filters.min_relevance) args.push('--min-relevance', String(filters.min_relevance));
      if (filters.limit) args.push('--limit', String(filters.limit));

      const proc = spawn("python", [CORPORATE_HUNTER, ...args], { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.stdin.end();

      proc.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(stderr || `Corporate hunter exit code ${code}`));
        }
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error("Corporate hunter JSON parse error"));
        }
      });
    });
  }

  /**
   * Generate teaser email for company lead
   */
  private generateTeaserEmail(
    company: CompanyLead,
    propertyData?: unknown,
    language: 'hu' | 'en' | 'de' = 'hu'
  ): TeaserEmail {
    const decisionMaker = company.decision_makers[0];
    const to = company.decision_makers
      .filter(dm => dm.email)
      .map(dm => dm.email as string);

    // Language-specific templates
    const templates = {
      hu: {
        subject: `Exkluzív Ingatlan Ajánlat - ${company.company_name} számára`,
        greeting: decisionMaker ? `Tisztelt ${decisionMaker.name}!` : 'Tisztelt Címzett!',
        intro: `A(z) ${company.company_name} vállalat ingatlanfejlesztési stratégiáját figyelembe véve szeretnénk felhívni figyelmét egy kiváló befektetési lehetőségre.`,
        pitch: `
Kulcsfontosságú előnyök:
- Prémium elhelyezkedés Budapest belvárosában
- Teljes közműellátottság
- Zöldmezős fejlesztési potenciál
- Versenyképes ár/érték arány

${company.notes ? `\n💡 Miért Önöknek ideális: ${company.notes}` : ''}
        `,
        cta: 'Kérem, jelezze vissza ha érdeklődik a részletek iránt. Személyes találkozót szívesen szervezek a következő hetekben.',
        closing: 'Üdvözlettel,\nIngatlan Értékesítési Csapat'
      },
      en: {
        subject: `Exclusive Real Estate Opportunity for ${company.company_name}`,
        greeting: decisionMaker ? `Dear ${decisionMaker.name},` : 'Dear Sir/Madam,',
        intro: `Considering ${company.company_name}'s real estate development strategy, we would like to draw your attention to an excellent investment opportunity.`,
        pitch: `
Key advantages:
- Premium location in Budapest city center
- Full utility infrastructure
- Greenfield development potential
- Competitive price/value ratio

${company.notes ? `\n💡 Why this is ideal for you: ${company.notes}` : ''}
        `,
        cta: 'Please let me know if you are interested in the details. I would be happy to arrange a personal meeting in the coming weeks.',
        closing: 'Best regards,\nReal Estate Sales Team'
      },
      de: {
        subject: `Exklusives Immobilienangebot für ${company.company_name}`,
        greeting: decisionMaker ? `Sehr geehrte/r ${decisionMaker.name},` : 'Sehr geehrte Damen und Herren,',
        intro: `Unter Berücksichtigung der Immobilienentwicklungsstrategie von ${company.company_name} möchten wir Ihre Aufmerksamkeit auf eine ausgezeichnete Investitionsmöglichkeit lenken.`,
        pitch: `
Hauptvorteile:
- Premium-Lage im Zentrum von Budapest
- Vollständige Versorgungsinfrastruktur
- Greenfield-Entwicklungspotenzial
- Wettbewerbsfähiges Preis-Leistungs-Verhältnis

${company.notes ? `\n💡 Warum dies ideal für Sie ist: ${company.notes}` : ''}
        `,
        cta: 'Bitte lassen Sie mich wissen, wenn Sie an den Details interessiert sind. Ich würde mich freuen, in den kommenden Wochen ein persönliches Treffen zu vereinbaren.',
        closing: 'Mit freundlichen Grüßen,\nImmobilienverkaufsteam'
      }
    };

    const template = templates[language];
    const body = `${template.greeting}

${template.intro}

${template.pitch}

${template.cta}

${template.closing}

---
*This is a personalized business proposal. If you are not the right contact person, please forward this to your acquisitions team.*
    `.trim();

    return {
      to,
      subject: template.subject,
      body,
      language,
      companyName: company.company_name,
      personalizations: {
        decisionMakerName: decisionMaker?.name,
        companySpecificNote: company.notes
      }
    };
  }

  /**
   * Execute agent task
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `Feladat indítása: ${task.slice(0, 40)}...`);

      // Corporate hunting
      if (task.toLowerCase().includes('hunt') || task.toLowerCase().includes('find companies') || task.toLowerCase().includes('leadek')) {
        const filters = (context as any)?.filters || {};
        const mock = (context as any)?.mock ?? true;

        logInfo(this.name, '🔍 Céges leadek keresése...');

        try {
          const result = await this.callCorporateHunter(filters, mock);
          
          logInfo(this.name, `✅ ${result.total_found} cég találva`);

          return {
            success: true,
            status: 'success',
            message: `🏢 ${result.total_found} potenciális cég leadet találtam!`,
            data: result
          };
        } catch (e: unknown) {
          const error = e instanceof Error ? e.message : String(e);
          logError(this.name, `Corporate hunting hiba: ${error}`);
          return { status: 'error', error };
        }
      }

      // Teaser email generation
      if (task.toLowerCase().includes('teaser') || task.toLowerCase().includes('email') || task.toLowerCase().includes('outreach')) {
        const companies = (context as any)?.companies as CompanyLead[] | undefined;
        const language = ((context as any)?.language || 'hu') as 'hu' | 'en' | 'de';
        const saveToCRM = (context as any)?.saveToCRM ?? false;
        const crmSheetId = (context as any)?.crmSheetId as string | undefined;

        if (!companies || companies.length === 0) {
          return {
            status: 'error',
            error: 'Nincs cég adat megadva az email generáláshoz.'
          };
        }

        logInfo(this.name, `📧 ${companies.length} teaser email generálása (${language})...`);

        const teaserEmails: TeaserEmail[] = companies.map(company => 
          this.generateTeaserEmail(company, (context as any)?.propertyData, language)
        );

        // Save drafts via Gmail API
        const draftResults = await Promise.all(
          teaserEmails.map(async (email, idx) => {
            try {
              const result = await googleWorkspaceHandler({
                operation: 'email_draft',
                params: {
                  to: email.to,
                  subject: email.subject,
                  body: email.body
                }
              });

              return {
                companyName: email.companyName,
                draftId: (result.data as any)?.draftId,
                recipients: email.to,
                language: email.language,
                success: result.success
              };
            } catch (e: unknown) {
              const error = e instanceof Error ? e.message : String(e);
              logError(this.name, `Draft ${idx} failure: ${error}`);
              return {
                companyName: email.companyName,
                success: false,
                error
              };
            }
          })
        );

        const successCount = draftResults.filter(r => r.success).length;

        // Optional: Save to CRM (Google Sheets)
        if (saveToCRM && crmSheetId) {
          try {
            const crmRows = companies.map((company, idx) => [
              new Date().toISOString(),
              company.company_name,
              company.industry,
              company.location,
              company.revenue_estimate || '',
              company.decision_makers.map(dm => dm.name).join(', '),
              company.decision_makers.map(dm => dm.email).filter(Boolean).join(', '),
              company.relevance_score,
              draftResults[idx]?.draftId || '',
              'draft_created',
              company.notes || ''
            ]);

            const crmResult = await googleWorkspaceHandler({
              operation: 'sheet_write',
              params: {
                spreadsheetId: crmSheetId,
                sheetName: 'Leads',
                rows: crmRows
              }
            });

            if (crmResult.success) {
              logInfo(this.name, `✅ ${crmRows.length} lead mentve CRM-be`);
            }
          } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            logError(this.name, `CRM save error: ${error}`);
          }
        }

        logInfo(this.name, `✅ ${successCount}/${draftResults.length} email draft létrehozva`);

        return {
          success: true,
          status: 'success',
          message: `📧 ${successCount} teaser email draft létrehozva. ${saveToCRM ? 'CRM-be mentve!' : 'Jóváhagyásra vár!'}`,
          data: {
            totalDrafts: draftResults.length,
            successfulDrafts: successCount,
            drafts: draftResults
          }
        };
      }

      // Default: hunt + generate
      return {
        status: 'error',
        error: 'Ismeretlen feladat. Használj: "hunt companies" vagy "generate teaser emails"'
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
