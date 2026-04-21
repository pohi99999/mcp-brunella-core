import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';

// Alap EUR/m² értékek típusonként
// TODO [tech-debt-cleanup]: replace with real market data from ResearcherAgent web scraping
const BASE_EUR_SQM: Record<string, number> = {
  apartment: 2200,
  house: 1800,
  industrial: 800,
  other: 1200,
};

const RISK_FLAGS_POOL = [
  'Hiányos vagy ellentmondásos dokumentáció',
  'Jogilag tisztázatlan terhek / korlátozások',
  'Alacsony összehasonlítható tranzakciószám',
  'Piaci volatilitás és hosszú értékesítési ciklus',
  'Közlekedési elérhetőség korlátozott',
  'Energetikai osztályozás elavult',
];

interface Comparable {
  address: string;
  priceEur: number;
  areaSqm: number;
  pricePerSqm: number;
}

interface ValuationRange {
  conservative: number;
  target: number;
  quick: number;
}

interface ResearchReport {
  location: string;
  propertyType: string;
  areaSqm: number;
  askingPrice: number;
  valuationRange: ValuationRange;
  comparables: Comparable[];
  riskFlags: string[];
  recommendation: string;
  generatedAt: string;
}

export class PropertyResearchAgent implements IAgent {
  name = 'PropertyResearch';
  role = 'Ingatlan Kutató és Értékelő Ügynök';
  description = 'Piaci összehasonlítás, értéktartomány és kutatási riport. Mock adatokkal, production-ready interfésszel.';
  capabilities = ['market_research', 'valuation_range', 'comparable_analysis', 'risk_assessment'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const ctx = (context ?? {}) as Record<string, unknown>;

      if (task === 'analyze') {
        return this.analyzeProperty(ctx);
      }

      return { status: 'error', error: `Ismeretlen feladat: "${task}". Próbáld: "analyze".` };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private analyzeProperty(ctx: Record<string, unknown>): AgentResponse {
    const location = String(ctx['location'] || 'Budapest').trim() || 'Budapest';
    const propertyType = String(ctx['propertyType'] || 'other').toLowerCase();
    const areaSqm = Number(ctx['areaSqm'] ?? 0);
    const askingPrice = Number(ctx['askingPrice'] ?? 0);

    const basePerSqm = BASE_EUR_SQM[propertyType] ?? BASE_EUR_SQM['other']!;
    const estimated = areaSqm > 0 ? Math.round(areaSqm * basePerSqm) : askingPrice;

    const valuationRange: ValuationRange = {
      conservative: Math.round(estimated * 0.85),
      target: estimated,
      quick: Math.round(estimated * 0.75),
    };

    // Mock comparables
    // TODO [tech-debt-cleanup]: replace with real comparable data from web scraping / property databases
    const comparables: Comparable[] = Array.from({ length: 5 }, (_, i) => {
      const variation = 0.85 + (i * 0.08);
      const compArea = Math.round(areaSqm * (0.9 + i * 0.05));
      const compPrice = Math.round(estimated * variation);
      return {
        address: `${location}, ${['Béla u.', 'Rózsa u.', 'Kossuth tér', 'Fő utca', 'Petőfi köz'][i]} ${i + 1}.`,
        priceEur: compPrice,
        areaSqm: compArea > 0 ? compArea : 60,
        pricePerSqm: compArea > 0 ? Math.round(compPrice / compArea) : basePerSqm,
      };
    });

    // Véletlenszerű 2-3 kockázati jelzés
    // TODO [tech-debt-cleanup]: replace with real risk assessment based on document analysis
    const shuffled = [...RISK_FLAGS_POOL].sort(() => Math.random() - 0.5);
    const riskFlags = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

    const discount = estimated > 0 ? (estimated - askingPrice) / estimated : 0;
    let recommendation = 'INVESTIGATE';
    if (discount > 0.2) recommendation = 'BUY';
    else if (discount > 0.05) recommendation = 'HOLD';
    else if (discount < -0.1) recommendation = 'PASS';

    const report: ResearchReport = {
      location,
      propertyType,
      areaSqm,
      askingPrice,
      valuationRange,
      comparables,
      riskFlags,
      recommendation,
      generatedAt: new Date().toISOString(),
    };

    logInfo(this.name, `Elemzés kész: ${location} ${propertyType}, ${recommendation}, ${valuationRange.target.toLocaleString('hu-HU')} EUR`);
    return { status: 'success', data: report };
  }
}

export default PropertyResearchAgent;

