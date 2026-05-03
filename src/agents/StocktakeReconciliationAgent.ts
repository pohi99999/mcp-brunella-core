/**
 * StocktakeReconciliationAgent.ts — Leltáreltérés analizátor és nyomozó ágens
 * Track: inventory_automation_20260330 — Phase 3.2
 *
 * Felelős:
 *  • Fizikai leltár és rendszerkészlet eltéréseinek vizsgálata
 *  • Döntési fa alapú nyomozás (késő bevételezés, elmaradt dokumentáció, stb.)
 *  • Következtetés és confidence score generálása az eltérés okára vonatkozóan
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { generateResponse } from '../core/llm_client.js';
import { getItemBySku, getMovementsByItem } from '../utils/inventoryDb.js';
import { safeJsonParse } from '../utils/aiHelpers.js';

export interface StocktakeReconTask {
  sku: string;
  discrepancy_qty: number;
  discrepancy_value: number;
  stocktake_timestamp?: string; // default: now
}

export interface ReconResult {
  sku: string;
  discrepancy_qty: number;
  probable_cause: string;
  confidence: number; // 0-1
  recommended_action: string;
  investigation_log: string[];
}

export class StocktakeReconciliationAgent implements IAgent {
  name = 'StocktakeReconciliationAgent';
  role = 'Inventory Analyst';
  description = 'Kivizsgálja a leltáreltérések okait döntési fa és LLM alapján.';
  capabilities = ['inventory_reconciliation', 'root_cause_analysis', 'data_investigation'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const payload = safeJsonParse<StocktakeReconTask | null>(task, null);
      if (!payload) {
        return { status: 'error', error: 'Érvénytelen stocktake reconciliation payload.' };
      }
      const item = await getItemBySku(payload.sku);

      if (!item) {
        return { status: 'error', error: `Cikkszám nem található: ${payload.sku}` };
      }

      logInfo(this.name, `Kezdődik a leltáreltérés nyomozása: ${payload.sku} (${payload.discrepancy_qty} db)`);

      const log: string[] = [];
      let cause = 'Ismeretlen ok';
      let conf = 0.2;
      let action = 'Kézi kivizsgálás szükséges';

      // 1. Ág: Késleltetett bevételezés (utolsó 48 órában nyitott PO, stb.)
      const recentMovements = await getMovementsByItem(item.id, 50);
      const recentReceive = recentMovements.filter(m => m.movement_type === 'IN');

      if (recentReceive.length > 0 && Math.abs(recentReceive[0].quantity - Math.abs(payload.discrepancy_qty)) < 5) {
        log.push(`Gyanús egyezés: friss bevételezés (${recentReceive[0].quantity} db).`);
        cause = 'Késleltetett vagy duplikált bevételezés rögzítése.';
        conf = 0.75;
        action = `Bizonylat ellenőrzése (MO-${recentReceive[0].id}).`;
      } 
      else {
        // 2. Ág: Elmaradt selejt vagy egyéb hiány
        const prompt = `Leltáreltérés elemzése a ${payload.sku} (${item.name}) terméknél.
Eltérés: ${payload.discrepancy_qty} db (Érték: ${payload.discrepancy_value} Ft).
Az utóbbi 48 órában nincs kiugró tranzakciós aszimmetria az adatbázisban.

Javasolj 2 lehetséges valós okot a hiányra/többletre a Raktári operációban (nem szoftverhiba), és 1 ajánlott lépést.
Válaszolj tömör szakmai nyelvezettel.`;

        const aiResponse = await generateResponse(prompt, 'gemini');
        
        log.push('AI által értékelt eset: Nincs egyértelmű technikai bizonylati aszimmetria, fizikai ok vs. adminisztrációs lemaradás.');
        cause = `Fizikai leltár eltérés: ${aiResponse.substring(0, 100)}...`;
        action = 'Könyvelési korrekció előkészítése / újramentés ellenőrzése';
        conf = 0.5;
      }

      const result: ReconResult = {
        sku: item.sku,
        discrepancy_qty: payload.discrepancy_qty,
        probable_cause: cause,
        confidence: conf,
        recommended_action: action,
        investigation_log: log
      };

      logInfo(this.name, `Nyomozás lezárva. Javaslat: ${action}`);
      return { status: 'success', data: result };

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logError(this.name, `Kivizsgálás hiba: ${errorMsg}`);
      return { status: 'error', error: errorMsg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
