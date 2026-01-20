import { mcpClient } from './mcpClient';

export interface SystemMetrics {
    uptime: number;
    cpuUsage: {
        user: number;
        system: number;
    };
    memory: {
        total: number;
        free: number;
        processHeap: number;
        processRss: number;
    };
    platform: string;
    loadavg: number[];
}

export class MonitorService {
    async getMetrics(): Promise<SystemMetrics> {
        try {
            const result = await mcpClient.callTool('monitor_get_metrics', {});
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                 return JSON.parse(result.content[0].text);
            }
            throw new Error("Invalid response");
        } catch (e) {
            console.error("Failed to get metrics", e);
            throw e;
        }
    }

    async getLogs(logName: string = 'web_ui.log', lines: number = 50): Promise<string> {
        try {
            const result = await mcpClient.callTool('monitor_get_logs', { logName, lines });
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                 return result.content[0].text;
            }
            return "";
        } catch (e) {
            console.error("Failed to get logs", e);
            return "Error loading logs.";
        }
    }
}

export const monitorService = new MonitorService();
