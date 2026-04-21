import { logInfo, logError } from "./logger.js";

/**
 * Kills any process listening on the specified port.
 * Supports Windows and Unix-like systems.
 *
 * @param port The port number to clear.
 */
export async function killProcessOnPort(port: number): Promise<void> {
  if (typeof process === 'undefined' || !process.versions?.node) {
    throw new Error("killProcessOnPort is only supported in Node.js environment");
  }

  const { exec } = await import("child_process");
  const platform = process.platform;

  return new Promise((resolve, reject) => {
    if (platform === "win32") {
      // Windows: Find PID via netstat and kill it
      const findCmd = `netstat -ano | findstr :${port}`;
      exec(findCmd, (error, stdout) => {
        if (error || !stdout) {
            // No process found or error finding it (e.g. port free)
            resolve();
            return;
        }

        // Parse PID from netstat output
        // Output format: TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       1234
        const lines = stdout.trim().split("\n");
        const pids = new Set<string>();

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid) && pid !== "0") {
                pids.add(pid);
            }
        }

        if (pids.size === 0) {
            resolve();
            return;
        }

        // Kill each PID
        const killPromises = Array.from(pids).map(pid => {
            return new Promise<void>((res) => {
                logInfo("ProcessUtils", `Killing process on port ${port} (PID: ${pid})`);
                exec(`taskkill /F /PID ${pid}`, (e) => {
                    if (e) logError("ProcessUtils", `Failed to kill PID ${pid}: ${e.message}`);
                    res();
                });
            });
        });

        Promise.all(killPromises).then(() => resolve());
      });
    } else {
      // Unix-like: Use lsof to find PID and kill it
      // lsof -t -i :<port> returns only PIDs
      const cmd = `lsof -t -i :${port} | xargs kill -9`;
      exec(cmd, (error) => {
         // Ignore error (e.g. no process found returns exit code 1)
         if (error && error.code !== 1) {
             // If error code is 1, it usually means no process found, which is fine.
             // But valid error might be permission denied.
             // We just log and proceed.
         }
         resolve();
      });
    }
  });
}
