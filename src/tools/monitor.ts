import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import os from 'os';

export function registerMonitorTools(server: McpServer) {
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
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}
