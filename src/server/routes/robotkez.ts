import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const robotkezTasks = new Map<
  string,
  { status: "in-progress" | "completed" | "failed"; result?: unknown }
>();

export function createRobotkezRoutes(): Router {
  const router = Router();

  router.post("/task", async (req, res) => {
    const taskId = uuidv4();
    const { task, headless = true, vision = true } = req.body;

    if (!task || typeof task !== "string") {
      res.status(400).send({ error: "A 'task' mező kötelező és string típusú kell legyen." });
      return;
    }

    robotkezTasks.set(taskId, { status: "in-progress" });

    try {
      const { stdout } = await execFileAsync("python", [
        "myai/browser_task_runner.py",
        "--task", task,
        "--headless", String(headless),
        "--vision", String(vision),
      ]);
      const result = JSON.parse(stdout);

      robotkezTasks.set(taskId, { status: "completed", result });
      res.status(200).send({ taskId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ismeretlen hiba";
      robotkezTasks.set(taskId, { status: "failed", result: errorMessage });
      res
        .status(500)
        .send({ error: "Feladat végrehajtási hiba.", details: errorMessage });
    }
  });

  router.get("/task/:id", (req, res) => {
    const { id } = req.params;
    const task = robotkezTasks.get(id);

    if (!task) {
      res.status(404).send({ error: "Feladat nem található." });
      return;
    }

    res.status(200).send(task);
  });

  return router;
}
