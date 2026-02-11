import { Router } from "express";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Helper to run shell commands
const runCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error.message}`);
        reject(error.message);
        return;
      }
      if (stderr && !stderr.includes("Created session")) {
        // Jules CLI might print info to stderr
        console.warn(`Stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
};

export function createJulesRoutes(): Router {
  const router = Router();
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "jules_cli_wrapper.py",
  );

  // GET /sessions - List all sessions
  router.get("/sessions", async (req, res) => {
    try {
      // Using the wrapper to list sessions.
      // Expecting JSON output or parsing text if wrapper doesn't support JSON flag yet.
      // Ideally assume wrapper outputs something parseable or we parse it here.
      // Let's assume the wrapper output is human readable for now and we send it raw
      // or we try to parse it if we can.

      // For now, let's just send the raw output or a mocked list if script fails
      const stdout = await runCommand(`python "${scriptPath}" list`);

      // Parse stdout to JSON if possible, otherwise return as raw text lines
      const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
      const sessions = lines.map((line) => {
        // Simple parser attempt: "SessionID Status Task..."
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          return {
            id: parts[0],
            status: parts[1],
            task: parts.slice(2).join(" "),
          };
        }
        return { id: "unknown", status: "unknown", task: line };
      });

      res.json({ sessions });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // POST /task - Create new task
  router.post("/task", async (req, res) => {
    const { task } = req.body;
    if (!task) {
      return res.status(400).json({ error: "Task is required" });
    }

    try {
      // Escape quotes in task to prevent shell injection issues (basic)
      const safeTask = task.replace(/"/g, '\\"');
      const stdout = await runCommand(
        `python "${scriptPath}" new "${safeTask}"`,
      );

      // Extract Session ID from output
      // Output example: "✅ Session created: 12345..."
      const match =
        stdout.match(/Session ID: (\d+)/) ||
        stdout.match(/Session created: (\d+)/);
      const sessionId = match ? match[1] : null;

      res.json({
        success: true,
        sessionId,
        output: stdout,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // POST /sync - Sync/Pull a session
  router.post("/sync", async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    try {
      const stdout = await runCommand(
        `python "${scriptPath}" pull "${sessionId}"`,
      );
      res.json({ success: true, output: stdout });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
