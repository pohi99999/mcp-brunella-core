import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

export function registerMonitorTools(server: McpServer) {
    server.tool(
        "monitor_get_metrics",
        "Returns system metrics (CPU, Memory, Uptime).",
        {},
        async () => {
            const memUsage = process.memoryUsage();
            const metrics = {
                uptime: process.uptime(),
                cpuUsage: process.cpuUsage(),
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    processHeap: memUsage.heapUsed,
                    processRss: memUsage.rss
                },
                platform: os.platform(),
                loadavg: os.loadavg()
            };
            return {
                content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }]
            };
        }
    );

    server.tool(
        "monitor_get_logs",
        "Returns the tail of specified log file.",
        {
            logName: z.enum(['agent-manager.log', 'web_ui.log', 'system_commands.log', 'brunella.db']).describe("Name of the log file"),
            lines: z.number().max(100).default(50).describe("Number of lines to return")
        },
        async ({ logName, lines }) => {
            const logPath = path.join(process.cwd(), 'logs', logName);
            try {
                await fs.access(logPath);
                
                const content = await fs.readFile(logPath, 'utf-8');
                const allLines = content.split('\n');
                const tail = allLines.slice(-lines).join('\n');
                
                return {
                    content: [{ type: "text", text: tail }]
                };
            } catch (e) {
                return {
                    content: [{ type: "text", text: `Log file not found or empty: ${logName}` }]
                };
            }
        }
    );
}
