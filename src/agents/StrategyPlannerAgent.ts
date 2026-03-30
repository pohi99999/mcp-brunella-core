import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { randomUUID } from 'crypto';

// TODO: replace with persistent storage (D1/SQLite) when production-ready
const planStore = new Map<string, StrategyPlan>();

interface Channel {
  name: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

interface StrategyPlan {
  planId: string;
  propertyType: string;
  location: string;
  estimatedValue: number;
  approvalState: 'pending' | 'approved' | 'rejected';
  channels: Channel[];
  targetSegments: string[];
  approvalSteps: string[];
  summary: string;
  generatedAt: string;
}

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

    const plan: StrategyPlan = {
      planId: randomUUID(),
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
      generatedAt: new Date().toISOString(),
    };

    planStore.set(plan.planId, plan);
    logInfo(this.name, `Terv kész: ${plan.planId} (${propertyType}, ${location})`);

    return { status: 'success', data: plan };
  }

  private approvePlan(ctx: Record<string, unknown>): AgentResponse {
    const planId = String(ctx['planId'] ?? '');
    const decision = String(ctx['decision'] ?? '');

    const plan = planStore.get(planId);
    if (!plan) {
      return { status: 'error', error: `Terv nem található: "${planId}"` };
    }

    if (decision === 'approved') {
      plan.approvalState = 'approved';
    } else if (decision === 'rejected') {
      plan.approvalState = 'rejected';
    } else {
      return { status: 'error', error: `Érvénytelen döntés: "${decision}". Érvényes: approved, rejected.` };
    }

    logInfo(this.name, `Terv ${decision}: ${planId}`);
    return { status: 'success', data: { ...plan } };
  }
}

export default StrategyPlannerAgent;
