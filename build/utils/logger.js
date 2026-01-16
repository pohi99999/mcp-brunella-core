"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliLogger = exports.systemLogger = exports.Logger = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
class Logger {
    logFile;
    constructor(filename) {
        this.logFile = path_1.default.join(index_js_1.config.systemLogDir, filename);
    }
    async log(message, meta) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
        try {
            // Ensure logs directory exists (redundant if ensured at startup but safe)
            await promises_1.default.mkdir(path_1.default.dirname(this.logFile), { recursive: true });
            await promises_1.default.appendFile(this.logFile, logEntry);
        }
        catch (error) {
            console.error(`Failed to write to log file: ${this.logFile}`, error);
        }
    }
}
exports.Logger = Logger;
exports.systemLogger = new Logger('system_commands.log');
exports.cliLogger = new Logger('cli_tools.log');
