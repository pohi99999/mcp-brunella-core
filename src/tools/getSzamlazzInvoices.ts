/**
 * Számlázz.hu API - MCP Tool Integration
 * Lekéri a számlákat az API-ből és InvoiceData objektumokra konvertálja őket
 */

import { spawn } from "child_process";
import { logInfo, logError } from "../utils/logger.js";

export const getSzamlazzInvoicesTool = {
  name: "get_szamlazz_invoices",
  description:
    "Lekeri a szamlaakat a Szamlazz.hu API-bol InvoiceData formátumban. Pydantic validacióval és error handling-gel.",
  inputSchema: {
    type: "object",
    properties: {
      since_date: {
        type: "string",
        description: "Opcionalis: Szamlak lekerese ettol a dátumtol (YYYY-MM-DD format). Ha nincs megadva, az osszes szam lekérve.",
      },
      limit: {
        type: "integer",
        description: "Maximum szamlaszam a lekerendesben (default: 100)",
        default: 100,
      },
      force_refresh: {
        type: "boolean",
        description: "Cache bypass - Friss lekeres az API-bol (default: false)",
        default: false,
      },
    },
    required: [],
  },
};

/**
 * Számlázz.hu API lekérés - Python subprocess hívás
 *
 * @param params Tool paraméterek
 * @returns Számlák list vagy error
 */
export async function getSzamlazzInvoicesHandler(params: {
  since_date?: string;
  limit?: number;
  force_refresh?: boolean;
}): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
  try {
    const { since_date, limit = 100, force_refresh = false } = params;

    logInfo("getSzamlazzInvoices", `Szamlak lekerese az API-bol... (since_date=${since_date}, limit=${limit}, force_refresh=${force_refresh})`);

    // Python subprocess futastasa
    const pythonCode = `import sys
sys.path.insert(0, '.')
import json
from myai.clients.szamlazz_hu_client import SzamlazzHuClient
from datetime import datetime, date

try:
    client = SzamlazzHuClient()
    
    # Kapcsolat teszt
    if not client.test_connection():
        print(json.dumps({"error": "Szamlazz.hu API nem erheto"}))
        sys.exit(1)
    
    # Szamlak lekerese
    since_date = "${since_date || ""}"
    if since_date:
        invoices = client.get_invoices_since(datetime.strptime(since_date, "%Y-%m-%d").date())
    else:
        invoices = client.get_invoices(limit=${limit})
    
    # Konvertalas JSON-ra
    invoice_dicts = []
    for invoice in invoices:
        invoice_dicts.append(invoice.dict_for_sheets())
    
    print(json.dumps({
        "success": True,
        "count": len(invoices),
        "invoices": invoice_dicts
    }))
    
except Exception as e:
    print(json.dumps({
        "error": str(e)
    }))
    sys.exit(1)
`;

    return new Promise((resolve) => {
      const python = spawn('python', ['-c', pythonCode]);
      let output = '';
      let error = '';

      python.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      python.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });

      python.on('close', (code: number) => {
        if (code !== 0) {
          logError('getSzamlazzInvoices', `Python script hiba: ${error}`);
          resolve({
            success: false,
            error: `Python hiba: ${error}`,
          });
          return;
        }

        try {
          const result = JSON.parse(output);

          if (result.error) {
            logError('getSzamlazzInvoices', result.error);
            resolve({
              success: false,
              error: result.error,
            });
          } else {
            logInfo('getSzamlazzInvoices', `${result.count} számla sikeresen lekérve`);
            resolve({
              success: true,
              data: result.invoices,
            });
          }
        } catch (parseError) {
          logError('getSzamlazzInvoices', `JSON parse hiba: ${parseError}`);
          resolve({
            success: false,
            error: `Válasz parse hiba: ${output}`,
          });
        }
      });
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logError('getSzamlazzInvoices', error);
    return {
      success: false,
      error,
    };
  }
}
