"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSystemHealth = checkSystemHealth;
const index_js_1 = require("../config/index.js");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
async function checkSystemHealth() {
    const status = {
        timestamp: new Date().toISOString(),
        workspace: index_js_1.config.workspaceRoot,
        nodeVersion: process.version,
        status: 'OK'
    };
    // Logolás - feltételezzük, hogy a könyvtár létezik
    const logPath = path_1.default.join(index_js_1.config.systemLogDir, 'health_status.json');
    try {
        await promises_1.default.writeFile(logPath, JSON.stringify(status, null, 2));
    }
    catch (e) {
        return JSON.stringify({ ...status, status: 'ERROR_WRITING_LOG' });
    }
    return JSON.stringify(status);
}
