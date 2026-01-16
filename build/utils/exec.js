"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCommand = execCommand;
const child_process_1 = require("child_process");
const logger_js_1 = require("./logger.js");
async function execCommand(command, args, options = {}) {
    const cwd = options.cwd || process.cwd();
    // Log the execution attempt
    await logger_js_1.cliLogger.log(`Executing: ${command} ${args.join(' ')}`, { cwd });
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)(command, args, {
            cwd,
            env: { ...process.env, ...options.env },
            shell: true // Be careful with this, but needed for some CLI tools in Windows
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => stdout += data.toString());
        proc.stderr.on('data', (data) => stderr += data.toString());
        const timeoutMs = options.timeout || 30000; // Default 30s timeout
        const timeout = setTimeout(() => {
            proc.kill();
            const errorMsg = `Command timed out after ${timeoutMs}ms`;
            logger_js_1.cliLogger.log(`Error: ${errorMsg}`);
            reject(new Error(errorMsg));
        }, timeoutMs);
        proc.on('close', (code) => {
            clearTimeout(timeout);
            logger_js_1.cliLogger.log(`Command finished`, { code });
            resolve({
                stdout,
                stderr,
                exitCode: code
            });
        });
        proc.on('error', (err) => {
            clearTimeout(timeout);
            logger_js_1.cliLogger.log(`Spawn error`, { error: err.message });
            reject(err);
        });
    });
}
