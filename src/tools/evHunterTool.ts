import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { globalPythonShell } from "../utils/pythonShell.js";
import { logInfo, logError } from "../utils/logger.js";

const AGENT = "EVHunter";

export interface EvHunterOptions {
  mock?: boolean;
  dryRun?: boolean;
  dry_run?: boolean; // For compat
}

export interface EvHunterToolResponse {
  isError?: boolean;
  content: { type: "text"; text: string }[];
  [key: string]: unknown;
}

export async function evHunterHandler(opts: EvHunterOptions): Promise<EvHunterToolResponse> {
  const mock = opts.mock ?? false;
  const dryRun = opts.dryRun ?? opts.dry_run ?? false;

  logInfo(AGENT, `EV Hunter running (mock=${mock}, dryRun=${dryRun})`);

  const flags: string[] = [];
  if (mock) flags.push("--mock");
  if (dryRun) flags.push("--dry-run");

  const code = `
import sys
import json
import asyncio
from pathlib import Path

# Setup paths
sys.argv = ['ev_hunter.py'${flags.map((f) => `, '${f}'`).join("")}]
sys.path.insert(0, 'myai/tasks')

try:
    from ev_hunter import run_ev_hunter
    results = asyncio.run(run_ev_hunter(mock=${mock ? "True" : "False"}, dry_run=${dryRun ? "True" : "False"}))
    print(json.dumps([r.model_dump() for r in results], indent=2, ensure_ascii=False))
except Exception as e:
    import traceback
    traceback.print_exc(file=sys.stderr)
    print(json.dumps({"error": str(e)}))
`;

  try {
    const output = await globalPythonShell.run(code);
    logInfo(AGENT, `EV Hunter completed, output length: ${output.length}`);
    return {
      content: [{ type: "text", text: output }],
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError(AGENT, `EV Hunter error: ${msg}`);
    return {
      isError: true,
      content: [{ type: "text", text: `EV Hunter error: ${msg}` }],
    };
  }
}

export function registerEvHunterTools(server: McpServer) {
  server.tool(
    "ev_hunter_search",
    "Runs the Green Lightning EV Hunter - searches willhaben.at and autoscout24 for electric vehicles matching configured criteria. Returns scored results as JSON.",
    {
      mock: z
        .boolean()
        .optional()
        .describe("Use mock data instead of real browser scraping (default: false)"),
      dry_run: z
        .boolean()
        .optional()
        .describe("Skip email sending, only generate results (default: false)"),
    },
    async ({ mock, dry_run }) => {
      // Map tool params to handler options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return evHunterHandler({ mock, dryRun: dry_run }) as any;
    },
  );
  
  server.tool(
    "ev_hunter_status",
    "Returns the latest EV Hunter results from the last run (if available).",
    {},
    async () => {
      const code = `
import json
from pathlib import Path
p = Path('data/ev_hunter_results.json')
if p.exists():
    data = json.loads(p.read_text(encoding='utf-8'))
    total = len(data)
    qualified = [d for d in data if d.get('score', 0) >= 60]
    top3 = sorted(qualified, key=lambda x: x['score'], reverse=True)[:3]
    print(json.dumps({
        'total': total,
        'qualified': len(qualified),
        'top3': top3,
        'file': str(p.absolute()),
    }, indent=2, ensure_ascii=False))
else:
    print(json.dumps({'error': 'No results found. Run ev_hunter_search first.'}, indent=2))
`;

      try {
        const output = await globalPythonShell.run(code);
        return {
          content: [{ type: "text", text: output }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          isError: true,
          content: [{ type: "text", text: `Status error: ${msg}` }],
        };
      }
    },
  );
}
