"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMonitorTools = registerMonitorTools;
const os_1 = __importDefault(require("os"));
function registerMonitorTools(server) {
    server.tool("monitor_get_metrics", "Returns system metrics including uptime, memory usage, and CPU load.", {}, async () => {
        const uptime = os_1.default.uptime();
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const loadAvg = os_1.default.loadavg();
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
    });
}
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}
