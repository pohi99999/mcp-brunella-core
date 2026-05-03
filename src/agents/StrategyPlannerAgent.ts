import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { randomUUID } from 'crypto';
import {
  insertStrategyPlan,
  getStrategyPlan,
  updatePlanApprovalState,
  insertPSalesAuditEvent,
  type StrategyChannel,
} from '../data/psales_db.js';

/**
 * @deprecated Use StrategyChannel from psales_db.ts.
 * Kept as a local alias for internal channel configuration maps.
 */
type Channel = StrategyChannel;

const CHANNEL_CONFIGS: Record<string, Channel[]> = {
  apartment: [
    { name: 'Ingatlan portál hirdetés', priority: 'high', description: 'ingatlan.com, ingatlanbazar.hu feltöltés' },
    { name: 'Közösségi média kampány', priority: 'medium', description: 'Facebook/Instagram célzott hirdetés' },
    { name: 'Ingatlanközvetítő', priority: 'medium', description: 'Helyi közvetítők bevonása' },
  ],
  house: [
    { name: 'Ingatlan portál hirdetés', priority: 'high', description: 'ingatlan.com, ingatlanbazar.hu feltöltés' },
    { name: 'Teaser kampány befektetőknek', priority: 'high', description: 'Céges befektetői kör megkeresése' },
    { name: 'Ingatlanközvetítő', priority: 'medium', description: 'Helyi közvetítők bevonása' },
  ],
  industrial: [
    { name: 'Direkt outreach döntéshozóknak', priority: 'high', description: 'Ipari / logisztikai vevők megkeresése' },
    { name: 'Teaser kampány befektetőknek', priority: 'high', description: 'Befektetői és fejlesztői kör' },
    { name: 'Szakmai portál hirdetés', priority: 'medium', description: 'Ipari ingatlan portálok' },
  ],
};

const DEFAULT_CHANNELS: Channel[] = [
  { name: 'Ingatlan portál hirdetés', priority: 'high', description: 'Általános portál feltöltés' },
  { name: 'Teaser kampány', priority: 'medium', description: 'Érdeklődői előszűrés' },
];

export class StrategyPlannerAgent implements IAgent {
  name = 'StrategyPlanner';
  role = 'Értékesítési Stratégia Tervező Ügynök';
  description = 'Csatorna mix ajánlás, approval gate, döntéshozói célcsoport lista. Mock adatokkal, production-ready interfésszel.';
  capabilities = ['channel_recommendation', 'approval_gate', 'target_list', 'strategy_report'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const ctx = (context ?? {}) as Record<string, unknown>;

      if (task === 'plan') return this.createPlan(ctx);
      if (task === 'approve') return this.approvePlan(ctx);

      return { status: 'error', error: `Ismeretlen feladat: "${task}". Próbáld: "plan" vagy "approve".` };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private createPlan(ctx: Record<string, unknown>): AgentResponse {
    const propertyType = String(ctx['propertyType'] || 'other').toLowerCase();
    const location = String(ctx['location'] || 'Budapest');
    const estimatedValue = Number(ctx['estimatedValue'] ?? 0);

    const channels = CHANNEL_CONFIGS[propertyType] ?? DEFAULT_CHANNELS;

    const targetSegments = propertyType === 'industrial'
      ? ['Ipari és logisztikai vevők', 'Fejlesztők', 'Befektetők', 'Önkormányzati szereplők']
      : ['Magánszemély vevők', 'Befektetők', 'Portálon aktív keresők', 'Helyi közvetítők'];

    const planId = randomUUID();
    const generatedAt = new Date().toISOString();

    const plan = insertStrategyPlan({
      planId,
      propertyType,
      location,
      estimatedValue,
      approvalState: 'pending',
      channels,
      targetSegments,
      approvalSteps: [
        'Stratégiai ajánlás áttekintése',
        'Csatorna mix jóváhagyása',
        'Első végrehajtási lépés engedélyezése',
      ],
      summary: `${location}-i ${propertyType} ingatlan értékesítési stratégiája. ` +
        `Becsült érték: ${estimatedValue.toLocaleString('hu-HU')} EUR. ` +
        `Javasolt csatornák: ${channels.map(c => c.name).join(', ')}.`,
      generatedAt,
    });

    insertPSalesAuditEvent(planId, 'plan_created', {
      actor: 'system',
      note: `Terv generálva: ${propertyType} @ ${location}`,
    });

    logInfo(this.name, `Terv kész: ${planId} (${propertyType}, ${location})`);
    return { status: 'success', data: plan };
  }

  private approvePlan(ctx: Record<string, unknown>): AgentResponse {
    const planId = String(ctx['planId'] ?? '');
    const decision = String(ctx['decision'] ?? '');
    const actor = typeof ctx['actor'] === 'string' ? ctx['actor'] : undefined;

    if (!planId) {
      return { status: 'error', error: 'planId kötelező' };
    }

    const existing = getStrategyPlan(planId);
    if (!existing) {
      return { status: 'error', error: `Terv nem található: "${planId}"` };
    }

    if (decision !== 'approved' && decision !== 'rejected') {
      return { status: 'error', error: `Érvénytelen döntés: "${decision}". Érvényes: approved, rejected.` };
    }

    const updated = updatePlanApprovalState(planId, decision, { actor });
    if (!updated) {
      return { status: 'error', error: `Terv állapota nem módosítható (jelenlegi állapot: ${existing.approvalState})` };
    }

    insertPSalesAuditEvent(planId, decision, {
      actor: actor ?? 'system',
      note: `Döntés: ${decision}`,
    });

    logInfo(this.name, `Terv ${decision}: ${planId}`);
    return { status: 'success', data: updated };
  }
}

export default StrategyPlannerAgent;
