/**
 * InventoryAdjustmentAgent.ts — Könyvelési korrekciós előkészítő (Leltáreltérés esetén)
 * Track: inventory_automation_20260330 — Phase 3.4
 *
 * Felelős:
 *  • Könyvelendő tételek generálása hiány (Selejt/Ráfordítás: T8 K2) vagy többlet (Fellelt készlet: T2 K9) esetén.
 *  • JSON payload a kognitív könyvelési modul számára (konyveles_kognitiv_bovites_20260330).
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export interface AdjustmentTask {
  sku: string;
  discrepancy_qty: number;
  discrepancy_value: number;
  date: string;
  reason: string;
}

export interface AccountingDoc {
  doc_id: string;
  account_debit: string;
  account_credit: string;
  amount: number;
  description: string;
  date: string;
  status: 'DRAFT_FOR_APPROVAL';
}

export class InventoryAdjustmentAgent implements IAgent {
  name = 'InventoryAdjustmentAgent';
  role = 'Könyvelés-előkészítő Controller';
  description = 'Automatikusan előállítja a leltáreltérések T/K könyvelési bizonylatait (DRAFT).';
  capabilities = ['accounting_preparation', 'journal_entries', 'inventory_adjustment'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const payload: AdjustmentTask = JSON.parse(task);

      if (payload.discrepancy_qty === 0) {
         logInfo(this.name, 'Nincs eltérés, nem generálunk bizonylatot.');
         return { status: 'success', data: null };
      }

      let doc: AccountingDoc;
      const absValue = Math.abs(payload.discrepancy_value);

      if (payload.discrepancy_qty < 0) { // hiány
        doc = {
          doc_id: `INV-ADJ-HIÁNY-${payload.sku}-${Date.now().toString().slice(-4)}`,
          account_debit: '8693',  // ráfordítás
          account_credit: '261',  // készlet
          amount: absValue,
          description: `Leltárhiány rögzítése (${payload.sku}): ${payload.reason}`,
          date: payload.date,
          status: 'DRAFT_FOR_APPROVAL'
        };
      } else { // többlet
        doc = {
          doc_id: `INV-ADJ-TÖBBLET-${payload.sku}-${Date.now().toString().slice(-4)}`,
          account_debit: '261',   // készlet
          account_credit: '9693', // bevétel
          amount: absValue,
          description: `Fellelt leltártöbblet (${payload.sku}): ${payload.reason}`,
          date: payload.date,
          status: 'DRAFT_FOR_APPROVAL'
        };
      }

      logInfo(this.name, `Draft könyvelési tétel elkészült: T ${doc.account_debit} / K ${doc.account_credit} - Érték: ${doc.amount} Ft`);
      return { status: 'success', data: doc };

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logError(this.name, `Könyvelés-előkészítés hiba: ${errorMsg}`);
      return { status: 'error', error: errorMsg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
