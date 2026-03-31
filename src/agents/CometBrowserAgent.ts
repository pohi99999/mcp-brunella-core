/**
 * CometBrowserAgent - Hibrid, önjavító és memóriával rendelkező böngésző ügynök.
 * A CometOrchestrator Python modult használja a háttérben.
 *
 * @author Brunella Core Team
 * @version 1.0.0
 */

import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { formatResponse } from '../utils/responseFormatter.js';

export class CometBrowserAgent extends BaseAgent {
  name = 'CometBrowser';
  role = 'Comet-szintű autonóm böngésző ügynök';
  description = 'Természetes nyelvű webfeladatok (keresés, adatkinyerés, form kitöltés) önjavító logikával és memóriával.';
  capabilities = [
    'web_search',
    'data_extract',
    'form_fill',
    'self_healing',
    'selector_memory',
    'vision_analysis'
  ];

  private readonly API_URL = 'http://localhost:8000/comet/execute';

  /**
   * Feladat végrehajtása a Python hibrid motor segítségével
   */
  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task || '').trim();
    setAgentStatus(this.name, 'working', task.slice(0, 60));

    logInfo(this.name, `Comet feladat indítása: "${task}"`);

    try {
      // 1. Python FastAPI hívás
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            task, 
            context: context.context || {} 
        })
      });

      if (!response.ok) {
        throw new Error(`FastAPI hiba: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      logInfo(this.name, `Comet kész: success=${result.success}, próbálkozások=${result.attempts}`);

      // 2. Válasz formázása és visszaküldése
      const message = result.success 
        ? `Sikeresen végrehajtottam a böngésző feladatot (${result.attempts} próbálkozásból).`
        : `Sajnos nem sikerült befejezni a feladatot: ${result.error}`;

      return {
        success: result.success,
        message: formatResponse(result, this.name),
        data: result
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(this.name, `Végrehajtási hiba: ${errorMsg}`);
      
      return {
        success: false,
        message: `Hiba történt a Comet motorral való kommunikáció során: ${errorMsg}`,
        data: { error: errorMsg }
      };
    }
  }
}

export default CometBrowserAgent;
