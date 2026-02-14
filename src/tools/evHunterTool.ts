import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { globalPythonShell } from "../utils/pythonShell.js";
import { logInfo, logError } from "../utils/logger.js";

const AGENT = "EVHunter";

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
      logInfo(AGENT, `EV Hunter search starting (mock=${mock ?? false}, dry_run=${dry_run ?? false})`);

      const flags: string[] = [];
      if (mock) flags.push("--mock");
      if (dry_run) flags.push("--dry-run");

      const code = `
import sys
sys.argv = ['ev_hunter.py'${flags.map((f) => `, '${f}'`).join("")}]
sys.path.insert(0, 'myai/tasks')
import asyncio
from ev_hunter import run_ev_hunter
results = asyncio.run(run_ev_hunter(mock=${mock ? "True" : "False"}, dry_run=${dry_run ? "True" : "False"}))
import json
print(json.dumps([r.model_dump() for r in results], indent=2, ensure_ascii=False))
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
