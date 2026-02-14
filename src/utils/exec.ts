import { cliLogger } from "./logger.js";

interface ExecOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
}

interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
}

export async function execCommand(command: string, args: string[], options: ExecOptions = {}): Promise<ExecResult> {
    const { spawn } = await import("child_process");
    const cwd = options.cwd || process.cwd();
    
    // Log the execution attempt
    await cliLogger.log(`Executing: ${command} ${args.join(' ')}`, { cwd });

    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd,
            env: { ...process.env, ...options.env },
            shell: true // Be careful with this, but needed for some CLI tools in Windows
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => stdout += data.toString());
        proc.stderr?.on('data', (data) => stderr += data.toString());

        const timeoutMs = options.timeout || 30000; // Default 30s timeout
        const timeout = setTimeout(() => {
            proc.kill();
            const errorMsg = `Command timed out after ${timeoutMs}ms`;
            cliLogger.log(`Error: ${errorMsg}`);
            reject(new Error(errorMsg));
        }, timeoutMs);

        proc.on('close', (code) => {
            clearTimeout(timeout);
            cliLogger.log(`Command finished`, { code });
            resolve({
                stdout,
                stderr,
                exitCode: code
            });
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            cliLogger.log(`Spawn error`, { error: err.message });
            reject(err);
        });
    });
}
