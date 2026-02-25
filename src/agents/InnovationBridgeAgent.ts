import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { generateResponse } from "../core/llm_client.js";
import trizMatrix from "../data/triz_matrix.json" assert { type: "json" };
import trizPrinciples from "../data/triz_principles.json" assert { type: "json" };
import { logInfo, logError } from "../utils/logger.js";
import { agentManager } from "./AgentManager.js";

export class InnovationBridgeAgent extends BaseAgent {
  name = "InnovationBridge";
  description = "TRIZ-based cross-industry knowledge transfer: solve industry problems with innovations from completely different industries";
  role = "Cross-Industry Innovation Transfer Specialist";
  capabilities = ["problem_abstraction", "triz_analysis", "cross_industry_search", "analogy_matching", "innovation_reporting"];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task || "";
    logInfo(this.name, `Starting innovation process for: ${task}`);

    try {
      // Stage 1: Analyze Intent and Extract TRIZ Parameters
      const analysis = await this.stage1_analyzeIntent(task);
      logInfo(this.name, `TRIZ Analysis complete: Improved=${analysis.improvedParam}, Worsened=${analysis.worsenedParam}`);

      // Stage 2: Map to TRIZ Principles
      const principleIds = this.stage2_mapPrinciples(analysis.improvedIndex, analysis.worsenedParamIndex);
      
      if (principleIds.length === 0) {
        return {
          success: true,
          message: "A TRIZ mátrix alapján nem találtam közvetlen alapelvet erre az ellentmondásra, de általános kutatást indíthatok.",
          data: { analysis, principles: [] }
        };
      }

      const principles = principleIds.map(id => trizPrinciples.find(p => p.id === id)).filter(Boolean);
      logInfo(this.name, `Launching swarm for principles: ${principleIds.join(", ")}`);

      // Stage 3: Launch Swarm Research
      const swarmResults = await this.stage3_launchSwarm(principles as any[], task);

      return {
        success: true,
        message: `Innovációs kutatás befejeződött. Azonosított ellentmondás: ${analysis.improvedParam} vs ${analysis.worsenedParam}. Javasolt megoldások száma: ${swarmResults.length}.`,
        thoughts: `A kutató raj ${swarmResults.length} analógiát talált távoli iparágakban. A szintézis motor készen áll az értékelésre.`,
        data: {
          trizAnalysis: analysis,
          suggestedPrinciples: principles,
          swarmResults
        }
      };

    } catch (error) {
      logError(this.name, `Innovation task failed: ${error}`);
      return {
        success: false,
        message: `Hiba az innovációs folyamat során: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Stage 3: Launch parallel research swarm
   */
  private async stage3_launchSwarm(principles: any[], originalTask: string) {
    const researchTasks = principles.map(p => {
      const instruction = `Find cross-industry analogies for the TRIZ principle "${p.name}" (${p.description}) to solve this problem: "${originalTask}". Look in biology, aerospace, or architecture. EXCLUDE software/electronics.`;
      
      return agentManager.delegate("Researcher", instruction);
    });

    const results = await Promise.allSettled(researchTasks);
    
    return results
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<any>).value);
  }

  /**
   * Stage 1: Extract TRIZ parameters using LLM
   */
  private async stage1_analyzeIntent(task: string) {
    const prompt = `You are a TRIZ expert. Analyze the following technical problem and identify which of the 39 TRIZ technical parameters should be IMPROVED and which one is WORSENING (the trade-off).

Problem: "${task}"

Available TRIZ Parameters:
${trizMatrix.parameters.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Respond ONLY with a JSON object in this format:
{
  "improvedIndex": number,
  "improvedParam": "name",
  "worsenedParamIndex": number,
  "worsenedParam": "name",
  "reasoning": "short explanation"
}`;

    const response = await generateResponse(prompt, { provider: "github" }); // Use GPT-4o for precision
    
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse LLM response as JSON");
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Failed to parse TRIZ parameters: ${e}`);
    }
  }

  /**
   * Stage 2: Matrix Lookup
   */
  private stage2_mapPrinciples(improvedIdx: number, worsenedIdx: number): number[] {
    const row = (trizMatrix.matrix as any)[improvedIdx.toString()];
    if (!row) return [];
    return row[worsenedIdx.toString()] || [];
  }
}

export default InnovationBridgeAgent;
