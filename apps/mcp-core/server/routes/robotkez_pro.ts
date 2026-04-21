import { Router } from "express";
import { RobotkezProService } from "../../services/RobotkezProService.js";

export function createRobotkezProRoutes(): Router {
  const router = Router();
  const service = RobotkezProService.getInstance();

  router.post("/execute", async (req, res) => {
    const { task } = req.body;
    const result = await service.executeAction({ action: 'click', description: String(task) });
    res.json(result);
  });

  router.post("/navigate", async (req, res) => {
    const { url } = req.body;
    const result = await service.executeAction({ action: 'navigate', url: String(url), description: `Navigate to ${url}` });
    res.json(result);
  });

  return router;
}
