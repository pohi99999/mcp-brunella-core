import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, logWarn, setAgentStatus } from '../utils/logger.js';
import { generateResponse } from '../core/llm_client.js';

/**
 * TRIZPrinciple - TRIZ (Theory of Inventive Problem Solving) alapelvek
 */
export interface TRIZPrinciple {
  id: number;
  name: string;
  description: string;
}

/**
 * AbstractProblem - Iparág-semleges problémaleírás
 */
export interface AbstractProblem {
  originalProblem: string;
  originalIndustry: string;
  abstractChallenge: string;
  trizPrinciples: TRIZPrinciple[];
  searchKeywords: string[];
}

/**
 * InnovationSolution - Cross-industry megoldás
 */
export interface InnovationSolution {
  sourceIndustry: string;
  solutionDescription: string;
  applicability: string;
  confidence: number;
  source?: string;
}

/**
 * InnovationBridgeReport - Teljes innováció transfer riport
 */
export interface InnovationBridgeReport {
  problem: AbstractProblem;
  solutions: InnovationSolution[];
  reportDate: string;
  markdown: string;
}

/**
 * InnovationBridgeAgent - Cross-Industry Knowledge Transfer Agent
 * 
 * TRIZ (Theory of Inventive Problem Solving) alapú innovációs keresőmotor.
 * Egy iparági problémát absztrakt mérnöki kihívássá alakít, majd megoldásokat 
 * keres teljesen más iparágakban.
 * 
 * Példa: "Hogyan csökkentsük a kórházi műtő takarítási időt?" 
 * → Absztrakt: "Gyors környezet-átállítás minimális leállással"
 * → Megoldás: Forma-1 kerékcsere technikák (pit stop methodology)
 */
export class InnovationBridgeAgent implements IAgent {
  name = 'InnovationBridge';
  role = 'Cross-Industry Innovation Transfer Specialist';
  description = 'TRIZ-alapú cross-industry knowledge transfer: iparági problémák megoldása más iparágakból származó innovációkkal';
  capabilities = [
    'problem_abstraction',
    'triz_analysis',
    'cross_industry_search',
    'analogy_matching',
    'innovation_reporting'
  ];

  /**
   * Common TRIZ principles (40 inventive principles simplified)
   */
  private readonly trizPrinciples: TRIZPrinciple[] = [
    { id: 1, name: 'Segmentation', description: 'Divide an object into independent parts' },
    { id: 2, name: 'Taking out', description: 'Separate interfering part or property from object' },
    { id: 10, name: 'Preliminary action', description: 'Perform required changes in advance' },
    { id: 15, name: 'Dynamicity', description: 'Make object adaptive, flexible' },
    { id: 17, name: 'Another dimension', description: 'Move to multi-level or 3D arrangement' },
    { id: 28, name: 'Mechanics substitution', description: 'Replace mechanical system with optical, acoustic, etc.' },
    { id: 35, name: 'Parameter changes', description: 'Change physical/chemical parameters' },
  ];

  /**
   * abstractProblem - Probléma absztrahálása TRIZ alapelvekkel
   */
  async abstractProblem(
    problem: string,
    industry?: string
  ): Promise<AbstractProblem> {
    logInfo(this.name, `Problem absztrahálása: ${problem.slice(0, 50)}...`);

    const prompt = `You are a TRIZ (Theory of Inventive Problem Solving) expert.

Given this industry-specific problem:
"${problem}"
${industry ? `Industry: ${industry}` : ''}

Please:
1. Abstract this problem into a general engineering/logistical challenge (industry-neutral)
2. Identify which TRIZ principles apply
3. Generate 3-5 search keywords for finding solutions in OTHER industries

Respond ONLY with valid JSON in this format:
{
  "abstractChallenge": "General description of the challenge",
  "trizPrinciples": [1, 15, 28],
  "searchKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

    try {
      const response = await generateResponse(prompt, 'gemini', 'gemini-2.0-flash');

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from LLM');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const abstractProblem: AbstractProblem = {
        originalProblem: problem,
        originalIndustry: industry || 'Unknown',
        abstractChallenge: parsed.abstractChallenge || 'Generic optimization challenge',
        trizPrinciples: (parsed.trizPrinciples || []).map((id: number) => 
          this.trizPrinciples.find(p => p.id === id) || { id, name: 'Unknown', description: '' }
        ),
        searchKeywords: parsed.searchKeywords || ['optimization', 'efficiency', 'innovation'],
      };

      logInfo(this.name, `Absztrakt kihívás: ${abstractProblem.abstractChallenge}`);
      return abstractProblem;

    } catch (error) {
      logError(this.name, `Problem abstraction hiba: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback abstract problem
      return {
        originalProblem: problem,
        originalIndustry: industry || 'Unknown',
        abstractChallenge: 'Optimization and efficiency improvement challenge',
        trizPrinciples: [this.trizPrinciples[0], this.trizPrinciples[3]],
        searchKeywords: ['optimization', 'efficiency', 'lean', 'automation'],
      };
    }
  }

  /**
   * findCrossIndustrySolutions - Megoldások keresése más iparágakban
   */
  async findCrossIndustrySolutions(
    abstractProblem: AbstractProblem,
    excludeIndustry?: string
  ): Promise<InnovationSolution[]> {
    logInfo(this.name, `Cross-industry megoldások keresése...`);

    const searchQuery = `
Case studies and innovations for: ${abstractProblem.abstractChallenge}
Keywords: ${abstractProblem.searchKeywords.join(', ')}
${excludeIndustry ? `Exclude ${excludeIndustry} industry` : ''}
Focus on: manufacturing, logistics, healthcare, automotive, aerospace, technology
`;

    const prompt = `You are an innovation transfer specialist.

Given this abstract challenge:
"${abstractProblem.abstractChallenge}"

Based on TRIZ principles: ${abstractProblem.trizPrinciples.map(p => p.name).join(', ')}

Find 3-5 innovative solutions from DIFFERENT industries (NOT ${excludeIndustry || 'the original industry'}).

For each solution, provide:
1. Source industry
2. Solution description (how they solved a similar abstract challenge)
3. How it applies to the original problem
4. Confidence score (0-100)

Respond ONLY with valid JSON array:
[
  {
    "sourceIndustry": "Industry name",
    "solutionDescription": "Brief description",
    "applicability": "How to apply to original problem",
    "confidence": 85,
    "source": "Optional reference"
  }
]`;

    try {
      const response = await generateResponse(prompt, 'gemini', 'gemini-2.0-flash');

      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON array response from LLM');
      }

      const solutions: InnovationSolution[] = JSON.parse(jsonMatch[0]);
      
      // Filter out same industry solutions
      const filtered = solutions.filter(s => 
        !excludeIndustry || 
        !s.sourceIndustry.toLowerCase().includes(excludeIndustry.toLowerCase())
      );

      logInfo(this.name, `${filtered.length} cross-industry megoldás találva`);
      return filtered;

    } catch (error) {
      logError(this.name, `Solution search hiba: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * generateReport - Innovation Bridge riport generálása markdown formátumban
   */
  generateReport(
    problem: AbstractProblem,
    solutions: InnovationSolution[]
  ): string {
    let md = `# 🌉 Innovation Bridge Report\n\n`;
    md += `**Generated:** ${new Date().toLocaleString('hu-HU')}\n\n`;
    md += `---\n\n`;

    // Original Problem
    md += `## 📋 Original Problem\n\n`;
    md += `**Industry:** ${problem.originalIndustry}\n\n`;
    md += `**Problem Statement:**\n> ${problem.originalProblem}\n\n`;

    // Abstract Challenge
    md += `## 🎯 Abstract Challenge (TRIZ Analysis)\n\n`;
    md += `**General Engineering Challenge:**\n> ${problem.abstractChallenge}\n\n`;
    
    md += `**Applicable TRIZ Principles:**\n`;
    problem.trizPrinciples.forEach(p => {
      md += `- **#${p.id} ${p.name}:** ${p.description}\n`;
    });
    md += `\n`;

    md += `**Search Keywords:** ${problem.searchKeywords.map(k => `\`${k}\``).join(', ')}\n\n`;

    // Cross-Industry Solutions
    md += `---\n\n`;
    md += `## 💡 Cross-Industry Solutions (${solutions.length} found)\n\n`;

    solutions.forEach((sol, idx) => {
      md += `### ${idx + 1}. ${sol.sourceIndustry} Industry\n\n`;
      md += `**Confidence:** ${sol.confidence}%  \n`;
      md += `**Solution:**\n${sol.solutionDescription}\n\n`;
      md += `**Application to Your Problem:**\n${sol.applicability}\n\n`;
      if (sol.source) {
        md += `**Source:** ${sol.source}\n\n`;
      }
      md += `---\n\n`;
    });

    // Next Steps
    md += `## ✅ Next Steps\n\n`;
    md += `1. **Evaluate** each solution's feasibility in your context\n`;
    md += `2. **Prototype** the most promising solution(s)\n`;
    md += `3. **Adapt** the cross-industry innovation to your specific needs\n`;
    md += `4. **Test** and iterate based on results\n\n`;

    md += `---\n\n`;
    md += `*Generated by InnovationBridgeAgent | Brunella AI System*\n`;

    return md;
  }

  /**
   * execute - IAgent standard interfész
   * 
   * Task parsing:
   * - "Find innovation for: <problem>" → full innovation bridge workflow
   * - "Abstract problem: <problem>" → csak absztrahálás
   * 
   * Context:
   * - problem: string (required)
   * - industry: string (optional, source industry)
   * - excludeIndustry: string (optional, industry to exclude)
   */
  async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));

    try {
      // Extract problem from task or context
      let problem = (context?.problem as string) || '';
      
      if (!problem) {
        // Try to extract from task
        const problemMatch = task.match(/(?:find innovation for|problem|challenge):?\s*(.+)/i);
        if (problemMatch) {
          problem = problemMatch[1].trim();
        } else {
          problem = task; // Whole task is the problem
        }
      }

      if (!problem || problem.length < 10) {
        return {
          status: 'error',
          error: 'Problem megadása szükséges - használd a context.problem mezőt vagy adj meg problémát a taskban',
        };
      }

      const industry = (context?.industry as string) || undefined;
      const excludeIndustry = (context?.excludeIndustry as string) || industry;

      logInfo(this.name, `Innovation Bridge indítása: ${problem.slice(0, 50)}...`);

      // Step 1: Abstract problem
      const abstractProblem = await this.abstractProblem(problem, industry);

      // Step 2: Find cross-industry solutions
      const solutions = await this.findCrossIndustrySolutions(abstractProblem, excludeIndustry);

      // Step 3: Generate report
      const markdown = this.generateReport(abstractProblem, solutions);

      const report: InnovationBridgeReport = {
        problem: abstractProblem,
        solutions,
        reportDate: new Date().toISOString(),
        markdown,
      };

      logInfo(this.name, `Innovation Bridge riport kész: ${solutions.length} megoldás`);

      return {
        status: 'success',
        data: report,
        metadata: {
          solutionCount: solutions.length,
          industry: industry || 'Unknown',
          trizPrinciples: abstractProblem.trizPrinciples.map(p => p.name),
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

export default InnovationBridgeAgent;
