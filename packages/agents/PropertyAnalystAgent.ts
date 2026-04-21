/**
 * PropertyAnalystAgent – Ingatlan Elemző Ügynök
 * Track: real_estate_sales_campaign_20260216 – Phase 1
 *
 * Glass Box: Ingatlan dokumentumokat (PDF/JPG/PNG) elemez Gemini Vision OCR-rel.
 * - vision_worker.py Python munkást delegál (subprocess spawn)
 * - PropertyAsset kinyerés + alapértékelés
 * - Phoenix Protocol: BaseAgent try/finally via execute() bridge garantálja a status reset-et
 *
 * Feladatok:
 *   execute("elemezd: plan.pdf")            → VisionResponse JSON
 *   execute("értékeld", { file_path: "..." }) → PropertyValuation
 *   execute("összegzés")                     → PropertyAnalysisResult lista
 */

import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { logInfo, logError, logDebug } from "@packages/utils/logger.js";
import { safeJsonParse } from "@packages/utils/aiHelpers.js";
import { ensureError } from '@packages/utils/ensureError.js';
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type {
  PropertyAsset,
  PropertyAnalysisResult,
  PropertyValuation,
  VisionResponse,
} from "@packages/types/property.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VISION_WORKER = path.resolve(
  __dirname,
  "../../myai/core/vision_worker.py"
);
const CMA_WORKER = path.resolve(
  __dirname,
  "../../myai/workers/cma_worker.py"
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Python vision_worker.py hívás
// ─────────────────────────────────────────────────────────────────────────────

function callVisionWorker(filePath: string, mock = false): Promise<VisionResponse> {
  return new Promise((resolve, reject) => {
    const args = [VISION_WORKER, "--file", filePath];
    if (mock) args.push("--mock");

    const proc = spawn("python", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.slice(0, 500) || `Exit code ${code}`));
      }
      try {
        const parsed = safeJsonParse<VisionResponse>(stdout.trim(), null as unknown as VisionResponse);
        if (!parsed) {
          logDebug('PropertyAnalyst', `Vision worker JSON parse error: invalid JSON`);
          return reject(new Error(`JSON parse hiba. stdout="${stdout.slice(0, 200)}"`));
        }
        resolve(parsed);
      } catch (error: unknown) {
        const err = ensureError(error);
        logDebug('PropertyAnalyst', `Vision worker JSON parse error: ${err.message}`);
        reject(new Error(`JSON parse hiba. stdout="${stdout.slice(0, 200)}"`));
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Helper: callCMAWorker - Hasonló ingatlanok és pontos értékbecslés (Phase 2)
 */
function callCMAWorker(location: string, type: string, area: number, mock = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      location,
      type: type.toLowerCase(),
      area_m2: area
    });
    if (mock || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      return resolve({
        estimate: {
          value_eur: 125000,
          value_huf: 50000000,
        },
        investment_score: 7.5,
        recommendation: `Mock CMA for ${location} (${type}, ${area} m²)`,
        comparables: [
          { address: 'Mock utca 1', price_eur: 120000, area_sqm: area },
          { address: 'Mock utca 2', price_eur: 130000, area_sqm: area },
        ],
      });
    }

    const args = [];
    if (mock) args.push("--mock");

    const proc = spawn("python", [CMA_WORKER, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    if (!mock) {
      proc.stdin.write(input);
    }
    proc.stdin.end();

    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `CMA Exit code ${code}`));
      try {
        const parsed = safeJsonParse<any>(stdout.trim(), null);
        if (!parsed) {
          logDebug('PropertyAnalyst', `CMA worker JSON parse error: invalid JSON`);
          return reject(new Error(`CMA JSON parse hiba. stdout="${stdout.slice(0,200)}"`));
        }
        resolve(parsed);
      } catch (error: unknown) {
        const err = ensureError(error);
        logDebug('PropertyAnalyst', `CMA worker JSON parse error: ${err.message}`);
        reject(new Error(`CMA JSON parse hiba. ${err.message}`));
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Alapértékelés (Phase 1 – CMA Phase 2-ben kerül in)
// ─────────────────────────────────────────────────────────────────────────────

function estimateValue(asset: PropertyAsset): PropertyValuation {
  const price = asset.asking_price_eur ?? 0;
  const area = asset.area_sqm ?? asset.lot_size_sqm ?? 0;

  const BASE_EUR_SQM: Record<string, number> = {
    apartment: 2200, house: 1800, land: 120,
    commercial: 1500, industrial: 800, storage: 600, other: 1000,
  };
  const propType = (asset.property_type || "other").toLowerCase();
  const basePerSqm = BASE_EUR_SQM[propType] ?? 1000;
  const estimated = area > 0 ? Math.round(area * basePerSqm) : price;
  const pricePersqm = area > 0 ? Math.round(price / area) : 0;

  const discount = estimated > 0 ? (estimated - price) / estimated : 0;
  let recommendation: PropertyValuation["recommendation"] = "INVESTIGATE";
  if (discount > 0.2) recommendation = "BUY";
  else if (discount > 0.05) recommendation = "HOLD";
  else if (discount < -0.1) recommendation = "PASS";

  return {
    asset_id: asset.id,
    hrsz: asset.hrsz,
    asking_price_eur: price,
    estimated_value_eur: estimated,
    price_per_sqm_eur: pricePersqm,
    confidence: asset.confidence,
    recommendation,
    reasoning: `Becsült érték ${estimated.toLocaleString("hu-HU")} EUR (${basePerSqm} EUR/m² alap). Diszkont: ${(discount * 100).toFixed(1)}%.`,
    comparables_count: 0,
    valuation_date: new Date().toISOString(),
  };
}

function buildActionItems(asset: PropertyAsset, val: PropertyValuation): string[] {
  const items: string[] = [];
  if (!asset.hrsz) items.push("⚠️ HRSZ hiányzik – tulajdoni lap ellenőrzés szükséges");
  if (asset.encumbrances.length > 0)
    items.push(`⚠️ ${asset.encumbrances.length} teher azonosítva – jogi átvilágítás`);
  if ((asset.confidence ?? 0) < 0.7)
    items.push("⚠️ Alacsony OCR megbízhatóság – kézi ellenőrzés ajánlott");
  if (val.recommendation === "BUY")
    items.push("🟢 Vételi ajánlat előkészítése (CMA szükséges)");
  if (val.recommendation === "PASS")
    items.push("🔴 Ár felülvizsgálat javasolt az értékesítési kampány előtt");
  if (!asset.utilities.gas)
    items.push("ℹ️ Gáz nincs bekötve – hőszolgáltatás tisztázása szükséges");
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// PropertyAnalystAgent
// ─────────────────────────────────────────────────────────────────────────────

export class PropertyAnalystAgent extends BaseAgent {
  name = "PropertyAnalyst";
  description =
    "Ingatlan dokumentumokat (PDF/JPG/PNG) elemez Gemini Vision OCR-rel. Kinyeri a HRSZ-t, alapterületet, közműveket, és alapértékelést végez.";
  role = "Ingatlan Elemző";
  capabilities = ["property_ocr", "document_ingestion", "property_valuation", "hrsz_extraction"];

  private _analyzed: PropertyAsset[] = [];

  get analyzedAssets(): PropertyAsset[] { return this._analyzed; }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task ?? "").toLowerCase();

    // ── Dokumentum elemzés ───────────────────────────────────────────────────
    if (task.includes("elemezd") || task.includes("analyze") || context.file_path) {
      const filePath = (context.file_path as string) ?? this._extractFilePath(context.task ?? "");
      if (!filePath) {
        return {
          success: false,
          message: "Hiányzó fájl elérési út. Adj meg 'file_path'-t a context-ben, vagy írd a feladatba: 'elemezd: <fájl>'.",
        };
      }

      const mock = (context.mock as boolean) ?? task.includes("mock");
      logInfo(this.name, `Dokumentum elemzés: ${filePath} (mock=${mock})`);

      let visionResp: VisionResponse;
      try {
        visionResp = await callVisionWorker(filePath, mock);
      } catch (error: unknown) {
        const err = ensureError(error);
        logError(this.name, `vision_worker hiba: ${err.message}`);
        return { success: false, message: `OCR worker hiba: ${err.message}` };
      }

      if (!visionResp.success || !visionResp.asset) {
        return { success: false, message: visionResp.error ?? "Vision worker ismeretlen hiba" };
      }

      const asset = visionResp.asset;
      this._analyzed.push(asset);
      const valuation = estimateValue(asset);
      const actionItems = buildActionItems(asset, valuation);
      const city = asset.address?.city || "–";

      const result: PropertyAnalysisResult = {
        asset,
        valuation,
        action_items: actionItems,
        market_summary:
          `${city}-i ${asset.property_type} ingatlan. ` +
          `Kért ár: ${valuation.asking_price_eur?.toLocaleString("hu-HU") ?? "–"} EUR, ` +
          `becsült érték: ${valuation.estimated_value_eur?.toLocaleString("hu-HU") ?? "–"} EUR. ` +
          `Ajánlás: ${valuation.recommendation}.`,
        generated_at: new Date().toISOString(),
      };

      return {
        success: true,
        message: `✅ Elemzés kész: ${asset.hrsz || asset.source_file} | ${valuation.recommendation} | ${valuation.estimated_value_eur?.toLocaleString("hu-HU")} EUR`,
        data: result,
        metadata: { hrsz: asset.hrsz, confidence: asset.confidence },
      };
    }

    // ── Értékelés (utolsó analysált asset) ──────────────────────────────────
    if (task.includes("értékeld") || task.includes("valuate") || task.includes("cma")) {
      if (this._analyzed.length === 0) {
        return { success: false, message: "Nincs elemzett ingatlan. Először hívd 'elemezd: <fájl>'." };
      }
      const asset = this._analyzed[this._analyzed.length - 1];
      const mock = (context.mock as boolean) ?? task.includes("mock");

      logInfo(this.name, `CMA piacelemzés indítása: ${asset.address?.city}, ${asset.area_sqm} m²`);

      try {
        const cmaReport = await callCMAWorker(
          asset.address?.city || asset.address?.formatted || "Budapest",
          asset.property_type || "apartment",
          asset.area_sqm || 0,
          mock
        );

        return {
          success: true,
          message: `📊 CMA Piacelemzés kész: ${cmaReport.estimate.value_eur.toLocaleString("hu-HU")} EUR | Score: ${cmaReport.investment_score}/10\n${cmaReport.recommendation}`,
          data: cmaReport,
        };
      } catch (error: unknown) {
        const err = ensureError(error);
        logError(this.name, `CMA hiba: ${err.message}. Visszalépés alapértékelésre.`);
        const valuation = estimateValue(asset);
        return {
          success: true,
          message: `📊 Alapértékelés (CMA hiba): ${valuation.recommendation} | ${valuation.estimated_value_eur?.toLocaleString("hu-HU")} EUR`,
          data: valuation,
        };
      }
    }

    // ── Összegzés ─────────────────────────────────────────────────────────────
    if (task.includes("összegzés") || task.includes("list") || task.includes("summary")) {
      const results: PropertyAnalysisResult[] = this._analyzed.map((asset) => ({
        asset,
        valuation: estimateValue(asset),
        generated_at: new Date().toISOString(),
      }));
      return {
        success: true,
        message: `📋 ${results.length} ingatlan elemzése elérhető.`,
        data: results,
      };
    }

    return {
      success: false,
      message: `Ismeretlen feladat: "${context.task}". Próbáld: "elemezd: fájl.pdf", "értékeld", "összegzés".`,
    };
  }

  private _extractFilePath(task: string): string {
    const m = task.match(/elemezd[:\s]+(.+)$/i) ?? task.match(/analyze[:\s]+(.+)$/i);
    return m ? m[1].trim() : "";
  }
}

export default PropertyAnalystAgent;

