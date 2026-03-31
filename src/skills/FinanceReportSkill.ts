import { getSzamlazzInvoicesHandler } from "../tools/getSzamlazzInvoices.js";
import { googleWorkspaceHandler } from "../tools/unifiedGoogleWorkspaceTool.js";
import { globalPythonShell } from "../utils/pythonShell.js";
import {
  captureValidationResult,
  isRecord,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireString,
  stringArrayParam,
  type SkillParams,
} from "./skill-helpers.js";
import type { BrunellaSkill } from "./skill.interface.js";

function extractInvoiceTotal(invoice: Record<string, unknown>): number | undefined {
  const candidateKeys = [
    "gross_total",
    "grossTotal",
    "totalGross",
    "total_gross",
    "net_total",
    "netTotal",
    "total",
    "amount",
    "amountGross",
    "gross",
  ];

  for (const key of candidateKeys) {
    const value = invoice[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    if (isRecord(value)) {
      const nested = extractInvoiceTotal(value);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  for (const value of Object.values(invoice)) {
    if (isRecord(value)) {
      const nested = extractInvoiceTotal(value);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
}

function normalizeTotals(totals: number[]): string {
  const payload = JSON.stringify(totals);
  return `
import json
import statistics

totals = json.loads(${JSON.stringify(payload)})
count = len(totals)
summary = {
    "count": count,
    "total": round(sum(totals), 2) if count else 0,
    "average": round(sum(totals) / count, 2) if count else 0,
    "minimum": round(min(totals), 2) if count else 0,
    "maximum": round(max(totals), 2) if count else 0,
    "median": round(statistics.median(totals), 2) if count else 0,
}
print(json.dumps(summary))
`;
}

function validateFinanceReportSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, "spreadsheetId", "spreadsheetId");
    requireString(params, "sheetName", "sheetName");
  });
}

export const FinanceReportSkill: BrunellaSkill = {
  name: "finance-report",
  description:
    "Számlákat kér le a Számlázz.hu forrásból, összesítést készít, és a riportot Google Sheets-be írja.",
  version: "1.0.0",
  category: "finance",
  tools: [
    "get_szamlazz_invoices",
    "google_workspace",
    "interpreter_run_python",
  ],
  agents: ["finance_guardian"],
  validate(params: SkillParams): boolean {
    return validateFinanceReportSkill(params).valid;
  },
  getValidationResult: validateFinanceReportSkill,
  async execute(params: SkillParams): Promise<unknown> {
    try {
      const spreadsheetId = requireString(params, "spreadsheetId", "spreadsheetId");
      const sheetName = requireString(params, "sheetName", "sheetName");
      const reportTitle = optionalString(params, "reportTitle") ?? "Finance Summary";
      const sinceDate = optionalString(params, "since_date");
      const limit = Math.max(1, Math.min(optionalNumber(params, "limit") ?? 100, 1000));
      const forceRefresh = optionalBoolean(params, "force_refresh") ?? false;
      const unpaidOnly = optionalBoolean(params, "include_unpaid_only") ?? false;
      const overdueOnly = optionalBoolean(params, "get_overdue") ?? false;
      const tags = stringArrayParam(params, "tags");

      const invoiceResult = await getSzamlazzInvoicesHandler({
        since_date: sinceDate,
        limit,
        force_refresh: forceRefresh,
        include_unpaid_only: unpaidOnly,
        get_overdue: overdueOnly,
      });

      if (!invoiceResult.success || !invoiceResult.data) {
        throw new Error(invoiceResult.error || "A számlalekérés nem sikerült.");
      }

      const invoices = invoiceResult.data;
      const totals = invoices
        .map((invoice) => (isRecord(invoice) ? extractInvoiceTotal(invoice) : undefined))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      const pythonSummaryText = await globalPythonShell.run(normalizeTotals(totals));
      const metrics = JSON.parse(pythonSummaryText) as {
        count: number;
        total: number;
        average: number;
        minimum: number;
        maximum: number;
        median: number;
      };

      const rows: Array<Array<string | number | boolean>> = [
        ["Riport", reportTitle],
        ["Vizsgált számlák", metrics.count],
        ["Összeg", metrics.total],
        ["Átlag", metrics.average],
        ["Minimum", metrics.minimum],
        ["Maximum", metrics.maximum],
        ["Medián", metrics.median],
        [],
        ["Típus", "Érték"],
        ...tags.map((tag) => ["Tag", tag] as Array<string | number | boolean>),
      ];

      const workspaceResult = await googleWorkspaceHandler({
        operation: "sheet_write",
        params: {
          spreadsheetId,
          sheetName,
          rows,
        },
      });

      return {
        success: true,
        skill: this.name,
        reportTitle,
        spreadsheetId,
        sheetName,
        filters: {
          sinceDate,
          limit,
          forceRefresh,
          unpaidOnly,
          overdueOnly,
        },
        invoiceCount: invoiceResult.stats?.count ?? invoices.length,
        metrics,
        workspaceResult,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        skill: this.name,
        error: message,
      };
    }
  },
};

export default FinanceReportSkill;

