import { BrunellaClient } from "../utils/mcpClient.js";
import { logError } from "../utils/logger.js";

type ToolResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  stats?: Record<string, unknown>;
  count?: number;
  invoices?: T;
  duplicates_skipped?: number;
  row_count?: number;
  health?: Record<string, unknown>;
};

export type InvoiceSyncOptions = {
  sinceDate?: string;
  limit?: number;
  forceRefresh?: boolean;
  includeUnpaidOnly?: boolean;
  getOverdue?: boolean;
  append?: boolean;
  clearFirst?: boolean;
  skipDuplicates?: boolean;
  batchSize?: number;
  dryRun?: boolean;
};

export type InvoiceSyncResult = {
  success: boolean;
  fetched: number;
  written: number;
  duplicatesSkipped: number;
  source?: string;
  message?: string;
  fetchStats?: Record<string, unknown>;
  writeResult?: Record<string, unknown>;
};

function getToolText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const content = (result as { content?: Array<{ text?: string }> }).content;
  if (!Array.isArray(content) || !content[0]?.text) return null;
  return content[0].text ?? null;
}

function parseToolJson<T>(result: unknown, toolName: string): T {
  const text = getToolText(result);
  if (!text) {
    throw new Error(`MCP tool '${toolName}' returned empty response`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`MCP tool '${toolName}' JSON parse error: ${msg}`);
  }
}

export async function runInvoiceSync(
  client: BrunellaClient,
  options: InvoiceSyncOptions,
): Promise<InvoiceSyncResult> {
  const fetchResult = await client.callTool("get_szamlazz_invoices", {
    since_date: options.sinceDate || undefined,
    limit: options.limit,
    force_refresh: options.forceRefresh,
    include_unpaid_only: options.includeUnpaidOnly,
    get_overdue: options.getOverdue,
  });

  const fetchParsed = parseToolJson<ToolResponse<Record<string, unknown>[]>>(
    fetchResult,
    "get_szamlazz_invoices",
  );

  if (!fetchParsed.success) {
    const error = fetchParsed.error || "Számla lekérés sikertelen";
    logError("InvoiceSync", error);
    return {
      success: false,
      fetched: 0,
      written: 0,
      duplicatesSkipped: 0,
      message: error,
    };
  }

  const invoices = fetchParsed.data || fetchParsed.invoices || [];
  const fetched = Array.isArray(invoices) ? invoices.length : 0;
  const source =
    (fetchParsed.stats?.health as Record<string, unknown> | undefined)?.source ||
    (fetchParsed.health as Record<string, unknown> | undefined)?.source ||
    "API";

  if (options.dryRun || fetched === 0) {
    return {
      success: true,
      fetched,
      written: 0,
      duplicatesSkipped: 0,
      source: typeof source === "string" ? source : "API",
      message: options.dryRun ? "Dry-run: nincs írás" : "Nincs új számla",
      fetchStats: fetchParsed.stats,
    };
  }

  const writeResult = await client.callTool("write_sheets_invoices", {
    invoices,
    append: options.append,
    clear_first: options.clearFirst,
    skip_duplicates: options.skipDuplicates,
    batch_size: options.batchSize,
  });

  const writeParsed = parseToolJson<ToolResponse<Record<string, unknown>>>(
    writeResult,
    "write_sheets_invoices",
  );

  if (!writeParsed.success) {
    const error = writeParsed.error || "Google Sheets írás sikertelen";
    logError("InvoiceSync", error);
    return {
      success: false,
      fetched,
      written: 0,
      duplicatesSkipped: 0,
      source: typeof source === "string" ? source : "API",
      message: error,
      fetchStats: fetchParsed.stats,
    };
  }

  const writeData = writeParsed.data || {};
  const written =
    typeof writeData.row_count === "number" ? writeData.row_count : fetched;
  const duplicatesSkipped =
    typeof writeData.duplicates_skipped === "number"
      ? writeData.duplicates_skipped
      : 0;

  return {
    success: true,
    fetched,
    written,
    duplicatesSkipped,
    source: typeof source === "string" ? source : "API",
    fetchStats: fetchParsed.stats,
    writeResult: writeData,
  };
}
