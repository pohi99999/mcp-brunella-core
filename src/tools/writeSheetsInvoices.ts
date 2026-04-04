/**
 * MCP Tool: Write Invoices to Google Sheets
 * Features: Batch write, append mode, line items support
 */

import { spawn } from "child_process";
import { logInfo, logError } from "../utils/logger.js";

export const writeSheetsInvoicesTool = {
  name: "write_sheets_invoices",
  description:
    "Invoice adatok írása Google Sheets-be (Phase 4: batch, duplicate detection, Phoenix Protocol retry)",
  inputSchema: {
    type: "object",
    properties: {
      invoices: {
        type: "array",
        description: "Invoice objects array",
        items: {
          type: "object",
        },
      },
      append: {
        type: "boolean",
        description: "Append mode (true) or replace (false)",
        default: true,
      },
      include_line_items: {
        type: "boolean",
        description: "Include line items in output",
        default: false,
      },
      clear_first: {
        type: "boolean",
        description: "Clear sheet before writing (if append=false)",
        default: false,
      },
      skip_duplicates: {
        type: "boolean",
        description: "Skip duplicate invoices by invoice_no (Phase 4)",
        default: true,
      },
      batch_size: {
        type: "number",
        description: "Rows per batch (optimal: 50-100, default: 75)",
        default: 75,
      },
    },
    required: ["invoices"],
  },
};

/**
 * Write invoices to Google Sheets
 * Phase 4 features: duplicate detection, batch write, Phoenix Protocol retry
 */
export async function writeSheetsInvoicesHandler(params: {
  invoices: Record<string, unknown>[];
  append?: boolean;
  include_line_items?: boolean;
  clear_first?: boolean;
  skip_duplicates?: boolean;
  batch_size?: number;
}): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const {
      invoices,
      append = true,
      include_line_items = false,
      clear_first = false,
      skip_duplicates = true,
      batch_size = 75,
    } = params;

    if (!invoices || invoices.length === 0) {
      return {
        success: false,
        error: "invoices array cannot be empty",
      };
    }

    logInfo("writeSheetsInvoices", `Writing ${invoices.length} invoices to Sheets (Phase 4: skip_duplicates=${skip_duplicates}, batch_size=${batch_size})`);

    // Python subprocess (updated for Phase 4)
    const pythonCode = `import sys
sys.path.insert(0, '"'"'.'"'"')
import json
from myai.clients.google_sheets_client import GoogleSheetsClient
from myai.schemas.invoice import InvoiceData
from datetime import date

try:
    client = GoogleSheetsClient()
    
    # Deserialize invoices JSON to InvoiceData
    invoices_data = ${JSON.stringify(invoices)}
    invoice_objects = []
    
    for inv in invoices_data:
        # Convert date strings back to date objects
        if invoice_date := inv.get('invoice_date'):
            inv['invoice_date'] = invoice_date if isinstance(invoice_date, str) else str(invoice_date)
        if due_date := inv.get('due_date'):
            inv['due_date'] = due_date if isinstance(due_date, str) else str(due_date)
        
        invoice_objects.append(InvoiceData(**inv))
    
    if ${clear_first}:
        client.clear_sheet()
    
    # Phase 4: Use enhanced write_invoices with duplicate detection & batch optimization
    result = client.write_invoices(
        invoices=invoice_objects,
        append=${append},
        include_line_items=${include_line_items},
        skip_duplicates=${skip_duplicates},
        batch_size=${batch_size}
    )
    
    print(json.dumps(result))
    
except Exception as e:
    import traceback
    print(json.dumps({
        "success": False,
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
          logError("writeSheetsInvoices", `Python error: ${error.substring(0, 200)}`);
          resolve({
            success: false,
            error: `Python error: ${error}`,
          });
          return;
        }

        try {
          const result = JSON.parse(output);

          if (result.success) {
            const duplicatesInfo = result.duplicates_skipped > 0 
              ? ` (${result.duplicates_skipped} duplicates skipped)` 
              : "";
            logInfo("writeSheetsInvoices", `✅ ${result.row_count} invoices written${duplicatesInfo}`);
          } else {
            logError("writeSheetsInvoices", result.error);
          }

          resolve({
            success: result.success,
            data: result,
          });
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          logError("writeSheetsInvoices", `JSON parse error: ${err.message}`);
          resolve({
            success: false,
            error: `Parse error: ${output.substring(0, 200)}`,
          });
        }
      });
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("writeSheetsInvoices", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}
