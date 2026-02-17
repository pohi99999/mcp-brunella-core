/**
 * Enhanced Szamlazz.hu & Gmail Invoice Fetcher - MCP Tool
 * Features: Szamlazz.hu API (primary), Gmail fallback, caching, error handling
 */

import { spawn } from "child_process";
import { logInfo, logError } from "../utils/logger.js";

export const getSzamlazzInvoicesTool = {
  name: "get_szamlazz_invoices",
  description:
    "Szamlak lekerese Szamlazz.hu API-bol + Gmail fallback (caching, robusztus error handling)",
  inputSchema: {
    type: "object",
    properties: {
      since_date: {
        type: "string",
        description: "Opcionalis: Szamlak lekerese ettol a datumtol (YYYY-MM-DD format)",
      },
      limit: {
        type: "integer",
        description: "Maximum szamlaszam (default: 100)",
        default: 100,
      },
      force_refresh: {
        type: "boolean",
        description: "Cache bypass (default: false)",
        default: false,
      },
      include_unpaid_only: {
        type: "boolean",
        description: "Csak nem fizetett szamlak (default: false)",
        default: false,
      },
      get_overdue: {
        type: "boolean",
        description: "Csak lejart hataridaju szamlak (default: false)",
        default: false,
      },
    },
    required: [],
  },
};

/**
 * Enhanced invoice fetcher - Szamlazz.hu + Gmail + Caching
 *
 * @param params Tool parameters
 * @returns Invoice list or error status
 */
export async function getSzamlazzInvoicesHandler(params: {
  since_date?: string;
  limit?: number;
  force_refresh?: boolean;
  include_unpaid_only?: boolean;
  get_overdue?: boolean;
}): Promise<{
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
  stats?: Record<string, unknown>;
}> {
  try {
    const {
      since_date,
      limit = 100,
      force_refresh = false,
      include_unpaid_only = false,
      get_overdue = false,
    } = params;

    logInfo(
      "getSzamlazzInvoices",
      `Enhanced: since=$`+'{since_date}, limit=$`'+'{limit}, force=$`'+'{force_refresh}`'
    );

    // Python subprocess - using EnhancedInvoiceClient
    const pythonCode = `import sys
sys.path.insert(0, '"'"'.'"'"')
import json
from myai.clients.enhanced_invoice_client import EnhancedInvoiceClient
from datetime import datetime, date

try:
    client = EnhancedInvoiceClient()
    health = client.health_check()
    
    since_date = "${since_date || ""}"
    since_date_obj = None
    if since_date:
        since_date_obj = datetime.strptime(since_date, "%Y-%m-%d").date()
    
    if ${get_overdue}:
        invoices = client.get_overdue_invoices()
    elif ${include_unpaid_only}:
        invoices = client.get_unpaid_invoices()
    else:
        invoices = client.get_invoices(
            since_date=since_date_obj,
            limit=${limit},
            force_refresh=${force_refresh}
        )
    
    invoice_dicts = []
    for invoice in invoices:
        invoice_dicts.append(invoice.dict_for_sheets())
    
    print(json.dumps({
        "success": True,
        "count": len(invoices),
        "invoices": invoice_dicts,
        "health": health
    }))
    
except Exception as e:
    import traceback
    print(json.dumps({
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc()
    }))
    sys.exit(1)
`;

    return new Promise((resolve) => {
      const python = spawn("python", ["-c", pythonCode]);
      let output = "";
      let error = "";

      python.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      python.stderr.on("data", (data: Buffer) => {
        error += data.toString();
      });

      python.on("close", (code: number) => {
        if (code !== 0) {
          logError("getSzamlazzInvoices", `Python error: $`+'{error.substring(0, 200)}`'
          );
          resolve({
            success: false,
            error: `Python error: $`+'{error}`'
,
          });
          return;
        }

        try {
          const result = JSON.parse(output);

          if (result.error) {
            logError("getSzamlazzInvoices", result.error);
            resolve({
              success: false,
              error: result.error,
            });
          } else {
            logInfo("getSzamlazzInvoices", `$`+'{result.count} invoices fetched`'
            );
            resolve({
              success: true,
              data: result.invoices,
              stats: {
                count: result.count,
                health: result.health,
              },
            });
          }
        } catch (parseError) {
          logError("getSzamlazzInvoices", `JSON parse: $`+'{parseError}`'
          );
          resolve({
            success: false,
            error: `Parse error: $`+'{output.substring(0, 200)}`'
,
          });
        }
      });
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logError("getSzamlazzInvoices", error);
    return {
      success: false,
      error,
    };
  }
}
