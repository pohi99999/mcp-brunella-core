/**
 * StocktakeReportAgent.ts — Természetes nyelvű leltárjelentés generátor
 * Track: inventory_automation_20260330 — Phase 3.3
 *
 * Felelős:
 *  • Leltáreltérések és azok nyomozati eredményeinek (StocktakeReconciliationAgent)
 *    alapján érthető vezetői összefoglaló, riport generálása (Markdown).
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';
import { generateResponse } from '@packages/core-logic/llm_client.js';
import { safeJsonParse } from '@packages/utils/aiHelpers.js';

export interface ReportTask {
  date: string;
  discrepancies: Array<{
    sku: string;
    system_qty: number;
    counted_qty: number;
    discrepancy_value: number;
    investigation_cause: string;
    confidence: number;
  }>;
  total_inventory_value: number;
}

export class StocktakeReportAgent implements IAgent {
  name = 'StocktakeReportAgent';
  role = 'Logisztikai Riportkészítő';
  description = 'Eltérések listája alapján természetes nyelvű, strukturált leltárösszesítőt ír MD formátumban.';
  capabilities = ['inventory_reporting', 'report_generation', 'markdown_formatting'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const payload = safeJsonParse<ReportTask | null>(task, null);
      if (!payload) {
        return { status: 'error', error: 'Érvénytelen stocktake report payload.' };
      }

      if (!payload.discrepancies || payload.discrepancies.length === 0) {
        return { status: 'success', data: { markdown: `## Leltárjelentés - ${payload.date}\nNincs regisztrált eltérés! A leltár hiánytalan.` } };
      }

      logInfo(this.name, `Jelentés generálása indul ${payload.discrepancies.length} eltéréssel.`);

      let discrepanciesText = '';
      payload.discrepancies.forEach(d => {
        discrepanciesText += `- SKU: **${d.sku}** | Rendszer: ${d.system_qty} | Számolt: ${d.counted_qty} | Eltérés érték: ${d.discrepancy_value} Ft\n`;
        discrepanciesText += `  *Nyomozati ok (${(d.confidence*100).toFixed(0)}% biztosság):* ${d.investigation_cause}\n`;
      });

      const prompt = `Készíts egy professzionális, letisztult vezetői leltárösszesítőt (Markdown) az alábbi adatokból:
Dátum: ${payload.date}
Összesített Készletérték: ${payload.total_inventory_value} Ft

Eltérések a fizikai számolás alapján:
${discrepanciesText}

Fogalmazz tárgyilagosan, emeld ki a pénzügyi hatást (szummázd az eltérések értékét), és tegyél javaslatot az adminisztratív/könyvelési korrekciók (InventoryAdjustmentAgent) jóváhagyására.
Nyelv: Magyar.`;

      const aiResponse = await generateResponse(prompt, 'gemini');

      logInfo(this.name, 'Leltárjelentés (MD) generálva.');
      return { status: 'success', data: { markdown: aiResponse } };

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logError(this.name, `Riportkészítés hiba: ${errorMsg}`);
      return { status: 'error', error: errorMsg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}

