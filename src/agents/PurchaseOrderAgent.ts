/**
 * PurchaseOrderAgent.ts — Autonóm beszerzési megrendelés generáló ágens
 * Track: inventory_automation_20260330 — Phase 2.3
 *
 * Felelős:
 *  • Készlethiányos termékek azonosítása (current_stock ≤ reorder_point)
 *  • LLM-alapú professzionális magyar ajánlatkérő/ megrendelő levél generálás
 *  • inventory_purchase_orders rekord létrehozása PENDING_APPROVAL státusszal
 *  • Emberi jóváhagyási kör (human-in-the-loop): az agent nem küld el semmit automatikusan
 *
 * Workflow:
 *   1. PurchaseOrderAgent fut → PENDING_APPROVAL PO-k létrejönnek
 *   2. Üzletvezető jóváhagyja/elutasítja az /api/v1/inventory/pending-orders végponton
 *   3. Jóváhagyás után: rendszer e-mail küld (külső integráció, Phase 4)
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import {
  getItemBySku,
  getItemsBelowReorderPoint,
  createPurchaseOrder,
  type InventoryItem,
} from '../utils/inventoryDb.js';
import { generateResponse } from '../core/llm_client.js';

// ─── Típusok ─────────────────────────────────────────────────────────────────

export interface PoGenerationResult {
  sku: string;
  name: string;
  current_stock: number;
  reorder_point: number;
  safety_stock: number;
  order_qty: number;
  po_reference: string;
  draft_email: string;
  status: 'PENDING_APPROVAL' | 'SKIPPED';
  reason?: string;
}

export interface PurchaseOrderTask {
  action: 'generate' | 'generate-all';
  sku?: string;           // ha 'generate': specifikus SKU-ra
  override_qty?: number;  // felülírja az automatikus számítást
  lead_time_override?: number;
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export class PurchaseOrderAgent implements IAgent {
  name = 'PurchaseOrderAgent';
  role = 'Autonóm beszerzési rendelés generáló';
  description = 'Automatikusan azonosítja a készlethiányos termékeket (current_stock ≤ reorder_point), LLM-mel professzionális magyar megrendelő levelet állít elő és PENDING_APPROVAL PO-t hoz létre emberi jóváhagyásra.';
  capabilities = [
    'purchase_order_generation',
    'reorder_detection',
    'supplier_email_draft',
    'human_in_the_loop',
  ];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));
    try {
      const parsed = typeof context === 'object' && context !== null
        ? (context as PurchaseOrderTask)
        : JSON.parse(task) as PurchaseOrderTask;

      if (parsed.action === 'generate' && parsed.sku) {
        const item = await getItemBySku(parsed.sku);
        if (!item) {
          return { status: 'error', error: `SKU nem található: ${parsed.sku}` };
        }

        const itemForGeneration: InventoryItem = {
          ...item,
          lead_time_days: parsed.lead_time_override ?? item.lead_time_days,
        };
        const result = await this.generatePoForItem(itemForGeneration, parsed.override_qty);
        return { status: 'success', data: result };
      }

      if (parsed.action === 'generate-all') {
        return await this.generateForAllBelowRop();
      }

      return { status: 'error', error: `Ismeretlen action: ${(parsed as PurchaseOrderTask).action}` };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, msg);
      return { status: 'error', error: msg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // ── Összes ROP alatti termékre PO ─────────────────────────────────────────

  async generateForAllBelowRop(): Promise<AgentResponse> {
    const items = await getItemsBelowReorderPoint();

    if (items.length === 0) {
      logInfo(this.name, 'Nincs újrarendelést igénylő termék');
      return {
        status: 'success',
        data: { orders: [], message: 'Minden termék készlete megfelelő szinten van.' },
      };
    }

    logInfo(this.name, `${items.length} termékre kell PO-t generálni`);

    const orders: PoGenerationResult[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        const result = await this.generatePoForItem(item);
        orders.push(result);
      } catch (e) {
        errors.push(`${item.sku}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    logInfo(this.name, `${orders.filter(o => o.status === 'PENDING_APPROVAL').length} PO létrehozva, ${errors.length} hiba`);

    return {
      status: 'success',
      data: {
        orders,
        errors,
        pending_approvals: orders.filter(o => o.status === 'PENDING_APPROVAL').length,
        generated_at: new Date().toISOString(),
      },
    };
  }

  // ── PO generálás egy termékre ─────────────────────────────────────────────

  async generatePoForItem(item: InventoryItem, overrideQty?: number): Promise<PoGenerationResult> {
    const orderQty = overrideQty ?? this.calculateOrderQty(item);
    const poReference = this.generatePoReference(item.sku);

    logInfo(this.name, `PO generálás: ${item.sku}, qty=${orderQty}, ref=${poReference}`);

    // LLM e-mail draft
    const draftEmail = await this.generateSupplierEmail(item, orderQty, poReference);
    const supplierName = item.supplier_id ?? 'Szállító';

    // DB mentés
    await createPurchaseOrder({
      item_id: item.id,
      sku: item.sku,
      order_qty: orderQty,
      estimated_unit_price: undefined,
      supplier_id: item.supplier_id ?? undefined,
      email_draft: draftEmail,
      ai_reasoning: `Automatikus ROP riasztás: készlet=${item.current_stock}, ROP=${item.reorder_point}`,
      confidence_score: 0.85,
    });

    return {
      sku: item.sku,
      name: item.name,
      current_stock: item.current_stock,
      reorder_point: item.reorder_point,
      safety_stock: item.safety_stock,
      order_qty: orderQty,
      po_reference: poReference,
      draft_email: draftEmail,
      status: 'PENDING_APPROVAL',
    };
  }

  // ── Rendelési mennyiség kalkuláció ────────────────────────────────────────

  /**
   * Economic Order Quantity közelítés:
   * order_qty = max(reorder_point × 2, safety_stock × 3, 1)
   * Egyszerű, de praktikus KKV-k számára.
   */
  calculateOrderQty(item: InventoryItem): number {
    const ropBased = item.reorder_point * 2;
    const safetyBased = item.safety_stock * 3;
    return Math.max(ropBased, safetyBased, 1);
  }

  // ── Segédfüggvények ───────────────────────────────────────────────────────

  private generatePoReference(sku: string): string {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `PO-${yyyymm}-${sku.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${rand}`;
  }

  private expectedDelivery(leadTimeDays: number): string {
    const d = new Date(Date.now() + leadTimeDays * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }

  // ── LLM-alapú szállítói e-mail ─────────────────────────────────────────────

  private async generateSupplierEmail(
    item: InventoryItem,
    orderQty: number,
    poReference: string
  ): Promise<string> {
    const prompt = `Te egy professzionális KKV üzletvezető vagy, aki szállítónak megrendelő levelet ír magyarul.

TERMÉK ADATOK:
- SKU: ${item.sku}
- Termék neve: ${item.name}
- Mennyiség: ${orderQty} ${item.unit}
- Szállító azonosító: ${item.supplier_id ?? 'nem meghatározott'}
- Megrendelési szám: ${poReference}
- Kért szállítási határidő: ${this.expectedDelivery(item.lead_time_days)} (${item.lead_time_days} napos szállítási idő alapján)

FELADAT: Írj egy rövid, professzionális magyar megrendelő e-mailt.

KÖVETELMÉNYEK:
- Tárgy legyen az első sorban "Tárgy: ..." formátumban
- Udvarias, üzleti stílusú
- Tartalmazza a cikkszámot, mennyiséget, szállítási határidőt és PO számot
- Maximum 150 szó
- Jelezd meg egyértelműen, hogy ez egy TERVEZET (jóváhagyásra vár)

Csak az e-mail szövegét írd le, semmi más kommentár.`;

    try {
      const email = await generateResponse(prompt, 'gemini');
      return email.trim();
    } catch (err) {
      logError(this.name, `LLM e-mail generálás sikertelen: ${item.sku} — sablonos fallback`);
      return this.fallbackEmailTemplate(item, orderQty, poReference);
    }
  }

  private fallbackEmailTemplate(item: InventoryItem, qty: number, poRef: string): string {
    return `Tárgy: Megrendelés – ${item.sku} – ${poRef} [TERVEZET - Jóváhagyásra vár]

Tisztelt Szállítónk!

Ezúton megrendeljük az alábbi terméket:

Megrendelési szám: ${poRef}
Cikkszám: ${item.sku}
Termék: ${item.name}
Mennyiség: ${qty} ${item.unit}
Kért szállítási határidő: ${this.expectedDelivery(item.lead_time_days)}

Kérjük, szíveskedjenek visszaigazolni a megrendelést és a szállítási lehetőséget.

Tisztelettsel,
Készletkezelő Rendszer (automatikus tervezet)`.trim();
  }
}
