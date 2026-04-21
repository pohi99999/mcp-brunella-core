import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, logWarn, setAgentStatus } from '@packages/utils/logger.js';
import { generateResponse } from '@packages/core-logic/llm_client.js';

/**
 * LawChange - Jogszabály változás
 */
export interface LawChange {
  title: string;
  publication: string;
  date: string;
  category: string;
  keywords: string[];
  relevanceScore: number;
  summary: string;
  businessImpact: string;
  source?: string;
}

/**
 * MonitoringConfig - Figyelési konfiguráció
 */
export interface MonitoringConfig {
  keywords: string[];
  teaorCodes?: string[];
  categories?: string[];
  threshold?: number; // Relevancia küszöb (0-100)
}

/**
 * LawDetectiveReport - Jogszabály-figyelési riport
 */
export interface LawDetectiveReport {
  monitoredKeywords: string[];
  totalChanges: number;
  relevantChanges: LawChange[];
  reportDate: string;
  markdown: string;
}

/**
 * LawDetectiveAgent - Magyar Közlöny Figyelő (Pillar 9)
 * 
 * Automata jogszabály-figyelés és elemzés KKV-k számára.
 * Figyeli a Magyar Közlönyt, elemzi az új jogszabályokat és értesít
 * a releváns változásokról.
 * 
 * Példa használat:
 * - "Figyeld a minimálbér változásokat"
 * - "Van-e új KATA szabály?"
 * - "Milyen adózási változások jönnek?"
 */
export class LawDetectiveAgent implements IAgent {
  name = 'LawDetective';
  role = 'Legal Intelligence & Compliance Monitor';
  description = 'Magyar Közlöny figyelő: jogszabály-változások automatikus monitoringja, elemzése és üzleti hatás értékelése';
  capabilities = [
    'law_monitoring',
    'legal_intelligence',
    'compliance_analysis',
    'business_impact_assessment',
    'magyar_kozlony_tracking'
  ];

  /**
   * Common legal keywords (magyar jogszabályok)
   */
  private readonly commonKeywords = [
    'minimálbér',
    'kata',
    'kiva',
    'szocho',
    'szja',
    'áfa',
    'tb',
    'munkaidő',
    'szabadság',
    'kötelező',
    'tiltott',
    'bírság',
    'hatóság',
    'engedély',
    'bejelentés',
  ];

  /**
   * Categories (jogszabály kategóriák)
   */
  private readonly categories = [
    'Munkaügy',
    'Adózás',
    'Társadalombiztosítás',
    'Vállalkozás',
    'Környezetvédelem',
    'Építésügy',
    'Egészségügy',
    'Oktatás',
  ];

  /**
   * analyzeLegalText - Jogszabály szöveg elemzése AI-val
   */
  async analyzeLegalText(
    text: string,
    keywords: string[]
  ): Promise<LawChange[]> {
    logInfo(this.name, `Jogszabály szöveg elemzése (${text.length} karakter)...`);

    const prompt = `You are a Hungarian legal intelligence analyst.

Analyze this legal/regulatory text and identify changes relevant to SMEs:

TEXT:
${text.slice(0, 3000)}

MONITORED KEYWORDS: ${keywords.join(', ')}

Extract all relevant legal changes. For each change, provide:
1. Title (short summary)
2. Category (e.g., Munkaügy, Adózás)
3. Matching keywords from the monitored list
4. Relevance score (0-100) for SME businesses
5. Brief summary (2-3 sentences in Hungarian)
6. Business impact assessment (1 sentence in Hungarian)

Respond ONLY with valid JSON array:
[
  {
    "title": "Minimálbér emelés 2026",
    "publication": "Magyar Közlöny 2026/15",
    "date": "2026-02-15",
    "category": "Munkaügy",
    "keywords": ["minimálbér", "munkaidő"],
    "relevanceScore": 95,
    "summary": "A minimálbér 2026. július 1-től 300,000 Ft-ra emelkedik.",
    "businessImpact": "Minden munkáltatónak át kell számolnia a bérköltségvetést."
  }
]

Focus on actionable changes that affect SME operations.`;

    try {
      const response = await generateResponse(prompt, 'gemini', 'gemini-2.0-flash');

      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logWarn(this.name, 'Nincs valid JSON válasz az LLM-től');
        return [];
      }

      const changes: LawChange[] = JSON.parse(jsonMatch[0]);
      
      logInfo(this.name, `${changes.length} releváns változás azonosítva`);
      return changes;

    } catch (error) {
      logError(this.name, `Legal analysis hiba: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * fetchMagyarKozlony - Magyar Közlöny legfrissebb számának szimulált letöltése
   * 
   * SIMPLIFIED VERSION: Valós implementációban Playwright/Apify scraping lenne
   */
  async fetchMagyarKozlony(): Promise<{ number: string; date: string; text: string }> {
    logInfo(this.name, 'Magyar Közlöny legfrissebb szám lekérdezése...');

    // SIMPLIFIED: Mock data (valódi implementációban web scraping)
    // A valódi verzióban ez lenne: ApifyScrapingAgent vagy Python Playwright worker
    
    const mockText = `
MAGYAR KÖZLÖNY 2026. évi 15. szám

I. TÖRVÉNYEK

2026. évi V. törvény
a minimálbér és a garantált bérminimum 2026. évi emeléséről

Az Országgyűlés a következő törvényt alkotja:

1. § A minimálbér havi összege 2026. július 1-jétől 300 000 forint.

2. § A garantált bérminimum havi összege 2026. július 1-jétől 350 000 forint.

3. § Ez a törvény 2026. július 1-jén lép hatályba.

---

II. KORMÁNYRENDELETEK

50/2026. (II. 15.) Korm. rendelet
a kata-adózás feltételeinek módosításáról

1. § A KATA adó mértéke 2026. szeptember 1-jétől:
   a) 75 000 forint havonta egyéni vállalkozók esetén,
   b) 100 000 forint havonta társas vállalkozások tagjai esetén.

2. § A KATA adóalanyok bevételi határa évi 12 000 000 forintra emelkedik.

---

III. MINISZTERI RENDELETEK

15/2026. (II. 15.) PM rendelet
az szja bevallás határidejének módosításáról

1. § A 2025. évi személyi jövedelemadó bevallás benyújtásának határideje
2026. május 20.

Ez a rendelet 2026. március 1-jén lép hatályba.
`;

    // Valós implementációban:
    // - Playwright navigáció magyarkozlony.hu-ra
    // - PDF letöltés
    // - OCR/PDF parsing
    // - Szöveg kinyerése

    return {
      number: '2026/15',
      date: '2026-02-15',
      text: mockText,
    };
  }

  /**
   * filterRelevantChanges - Releváns változások szűrése
   */
  filterRelevantChanges(
    changes: LawChange[],
    config: MonitoringConfig
  ): LawChange[] {
    const threshold = config.threshold || 50;

    return changes.filter(change => {
      // Relevancia szűrés
      if (change.relevanceScore < threshold) {
        return false;
      }

      // Kulcsszó egyezés
      const hasKeyword = change.keywords.some(kw => 
        config.keywords.some(monitored => 
          kw.toLowerCase().includes(monitored.toLowerCase()) ||
          monitored.toLowerCase().includes(kw.toLowerCase())
        )
      );

      // Kategória egyezés (opcionális)
      if (config.categories && config.categories.length > 0) {
        const hasCategory = config.categories.includes(change.category);
        return hasKeyword && hasCategory;
      }

      return hasKeyword;
    });
  }

  /**
   * generateReport - Jogszabály-figyelési riport generálása
   */
  generateReport(
    changes: LawChange[],
    config: MonitoringConfig
  ): string {
    let md = `# ⚖️ Law Detective Report - Magyar Közlöny Figyelés\n\n`;
    md += `**Generálva:** ${new Date().toLocaleString('hu-HU')}\n\n`;
    md += `---\n\n`;

    // Monitoring config
    md += `## 🔍 Figyelési Beállítások\n\n`;
    md += `**Kulcsszavak:** ${config.keywords.map(k => `\`${k}\``).join(', ')}\n`;
    if (config.categories && config.categories.length > 0) {
      md += `**Kategóriák:** ${config.categories.join(', ')}\n`;
    }
    md += `**Relevancia küszöb:** ${config.threshold || 50}%\n\n`;

    // Summary
    md += `---\n\n`;
    md += `## 📊 Összefoglaló\n\n`;
    md += `**Összes változás:** ${changes.length}\n`;
    
    const highPriority = changes.filter(c => c.relevanceScore >= 80).length;
    const mediumPriority = changes.filter(c => c.relevanceScore >= 50 && c.relevanceScore < 80).length;
    
    md += `- 🔴 Magas prioritás (≥80%): ${highPriority}\n`;
    md += `- 🟡 Közepes prioritás (50-79%): ${mediumPriority}\n\n`;

    // Changes by category
    const byCategory = changes.reduce((acc, change) => {
      acc[change.category] = (acc[change.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(byCategory).length > 0) {
      md += `**Eloszlás kategóriánként:**\n`;
      Object.entries(byCategory).forEach(([cat, count]) => {
        md += `- ${cat}: ${count} változás\n`;
      });
      md += `\n`;
    }

    // Detailed changes
    md += `---\n\n`;
    md += `## 📋 Részletes Változások\n\n`;

    changes.forEach((change, idx) => {
      const priorityIcon = change.relevanceScore >= 80 ? '🔴' : 
                          change.relevanceScore >= 50 ? '🟡' : '⚪';
      
      md += `### ${idx + 1}. ${priorityIcon} ${change.title}\n\n`;
      md += `**Kategória:** ${change.category}  \n`;
      md += `**Publikáció:** ${change.publication}  \n`;
      md += `**Dátum:** ${change.date}  \n`;
      md += `**Relevancia:** ${change.relevanceScore}%  \n`;
      md += `**Kulcsszavak:** ${change.keywords.map(k => `\`${k}\``).join(', ')}  \n\n`;
      
      md += `**Összefoglaló:**\n${change.summary}\n\n`;
      md += `**Üzleti hatás:**\n> ${change.businessImpact}\n\n`;
      
      if (change.source) {
        md += `**Forrás:** ${change.source}\n\n`;
      }
      
      md += `---\n\n`;
    });

    // Action items
    md += `## ✅ Teendők\n\n`;
    md += `1. **Ellenőrizd** a magas prioritású változásokat (🔴)\n`;
    md += `2. **Konzultálj** könyvelőddel vagy jogászoddal\n`;
    md += `3. **Frissítsd** a belső folyamatokat és dokumentációt\n`;
    md += `4. **Tájékoztasd** az érintett munkatársakat\n`;
    md += `5. **Állíts be** emlékeztetőket a hatályba lépés dátumára\n\n`;

    md += `---\n\n`;
    md += `*Generálta: LawDetectiveAgent | Brunella AI System*\n`;

    return md;
  }

  /**
   * execute - IAgent standard interfész
   * 
   * Task parsing:
   * - "Figyeld a minimálbér változásokat" → monitoring
   * - "Mi változott a KATA-ban?" → specific query
   * 
   * Context:
   * - keywords: string[] (figyelt kulcsszavak)
   * - categories: string[] (opcionális kategóriák)
   * - threshold: number (relevancia küszöb, default: 50)
   */
  async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));

    try {
      // Build monitoring config
      let keywords = (context?.keywords as string[]) || [];
      
      if (keywords.length === 0) {
        // Extract keywords from task
        const taskLower = task.toLowerCase();
        keywords = this.commonKeywords.filter(kw => taskLower.includes(kw));
        
        // If still empty, use default important keywords
        if (keywords.length === 0) {
          keywords = ['minimálbér', 'kata', 'szja', 'áfa', 'tb', 'munka'];
        }
      }

      const config: MonitoringConfig = {
        keywords,
        categories: (context?.categories as string[]) || undefined,
        threshold: (context?.threshold as number) || 50,
      };

      logInfo(this.name, `Law Detective indítása: ${keywords.join(', ')}`);

      // Step 1: Fetch latest Magyar Közlöny
      const kozlony = await this.fetchMagyarKozlony();
      logInfo(this.name, `Magyar Közlöny ${kozlony.number} lekérve`);

      // Step 2: Analyze legal text
      const allChanges = await this.analyzeLegalText(kozlony.text, keywords);

      // Step 3: Filter relevant changes
      const relevantChanges = this.filterRelevantChanges(allChanges, config);
      logInfo(this.name, `${relevantChanges.length}/${allChanges.length} releváns változás szűrve`);

      // Step 4: Generate report
      const markdown = this.generateReport(relevantChanges, config);

      const report: LawDetectiveReport = {
        monitoredKeywords: config.keywords,
        totalChanges: relevantChanges.length,
        relevantChanges,
        reportDate: new Date().toISOString(),
        markdown,
      };

      logInfo(this.name, `Law Detective riport kész: ${relevantChanges.length} változás`);

      return {
        status: 'success',
        data: report,
        metadata: {
          kozlonyNumber: kozlony.number,
          kozlonyDate: kozlony.date,
          totalChanges: allChanges.length,
          relevantChanges: relevantChanges.length,
          keywords: config.keywords,
        },
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(this.name, errorMsg);

      return {
        status: 'error',
        error: errorMsg,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}

export default LawDetectiveAgent;

