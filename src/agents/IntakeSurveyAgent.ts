import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

// Kötelező iratok ingatlantípusonként
// TODO: replace with dynamic document requirements from property database
const REQUIRED_DOCS: Record<string, string[]> = {
  apartment: [
    'tulajdoni lap',
    'alaprajz',
    'közös képviselői igazolás',
    'energetikai tanúsítvány',
  ],
  house: [
    'tulajdoni lap',
    'helyszínrajz',
    'használatbavételi engedély',
    'közműdokumentumok',
    'energetikai tanúsítvány',
  ],
  industrial: [
    'tulajdoni lap',
    'területrendezési igazolás',
    'környezeti nyilatkozat',
    'műszaki dokumentáció',
    'közlekedési elérhetőség',
    'közműkapcsolódási adatok',
  ],
};

export class IntakeSurveyAgent implements IAgent {
  name = 'IntakeSurvey';
  role = 'Ingatlan Felmérő Ügynök';
  description = 'Dokumentumfeltöltési folyam, hiánylista generálás, teljességjelző ingatlantípus szerint.';
  capabilities = ['intake_checklist', 'document_survey', 'completeness_check'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const ctx = (context ?? {}) as Record<string, unknown>;

      if (task === 'checklist') {
        return this.getChecklist(ctx);
      }
      if (task === 'survey') {
        return this.runSurvey(ctx);
      }

      return { status: 'error', error: `Ismeretlen feladat: "${task}". Próbáld: "checklist" vagy "survey".` };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private getChecklist(ctx: Record<string, unknown>): AgentResponse {
    const propertyType = String(ctx['propertyType'] ?? '').toLowerCase();
    const required = REQUIRED_DOCS[propertyType];

    if (!required) {
      return { status: 'error', error: `Ismeretlen ingatlantípus: "${propertyType}". Érvényes: apartment, house, industrial.` };
    }

    logInfo(this.name, `Kötelező iratok: ${propertyType} (${required.length} db)`);
    return {
      status: 'success',
      data: { propertyType, required },
    };
  }

  private runSurvey(ctx: Record<string, unknown>): AgentResponse {
    const propertyType = String(ctx['propertyType'] ?? '').toLowerCase();
    const uploadedDocs = (ctx['uploadedDocs'] as string[] | undefined) ?? [];
    const required = REQUIRED_DOCS[propertyType];

    if (!required) {
      return { status: 'error', error: `Ismeretlen ingatlantípus: "${propertyType}".` };
    }

    const uploadedLower = uploadedDocs.map(d => d.toLowerCase());
    const missing = required.filter(r => !uploadedLower.includes(r.toLowerCase()));
    const completeness = Math.round(((required.length - missing.length) / required.length) * 100);

    logInfo(this.name, `Felmérés: ${propertyType}, ${completeness}% kész, ${missing.length} hiányzó`);

    return {
      status: 'success',
      data: {
        propertyType,
        required,
        uploadedDocs,
        missing,
        completeness,
        isComplete: missing.length === 0,
      },
    };
  }
}

export default IntakeSurveyAgent;
