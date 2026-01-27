import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { z } from "zod";

// Relaxed typing to avoid deeply nested generic instantiation issues during test builds.
// Runtime behaviour unchanged; MCP SDK still provides shape/validation.
export function registerMonitorTools(server: McpServer | any) {
  server.tool(
    "monitor_get_metrics",
    "Returns system metrics including uptime, memory usage, and CPU load.",
    {},
    async () => {
      const uptime = os.uptime();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const loadAvg = os.loadavg();

      const metrics = {
        uptime: uptime,
        uptime_human: formatUptime(uptime),
        memory: {
          total: totalMem,
          free: freeMem,
          used: totalMem - freeMem,
          usage_percent: ((totalMem - freeMem) / totalMem * 100).toFixed(2) + "%"
        },
        cpu: {
          load_avg_1m: loadAvg[0],
          load_avg_5m: loadAvg[1],
          load_avg_15m: loadAvg[2]
        },
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(metrics, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "monitor_tail_logs",
    "Reads the last N lines of a specified log file.",
    {
      log_file: z.string(),
      lines: z.number().optional()
    } as Record<string, z.ZodTypeAny>,
    async ({ log_file, lines: linesArg }: { log_file: string; lines?: number }) => {
      const lines = linesArg ?? 50;
      const logDir = path.join(process.cwd(), 'logs');
      const targetPath = path.join(logDir, log_file);

      // Security check
      if (!targetPath.startsWith(logDir)) {
        return { isError: true, content: [{ type: "text", text: "Access denied." }] };
      }

      try {
        const content = await fs.readFile(targetPath, 'utf-8');
        const allLines = content.split('\n');
        const lastLines = allLines.slice(-lines).join('\n');

        return {
          content: [{ type: "text", text: lastLines }]
        };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `Error reading log: ${e.message}` }] };
      }
    }
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}
