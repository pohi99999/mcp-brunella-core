import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogisticsRoutes } from "../src/server/routes/logistics.js";

describe("repository-local logistics routes", () => {
  it("returns the split boundary and logistics capabilities", async () => {
    const app = express();
    app.use("/api/logistics", createLogisticsRoutes());

    const response = await request(app).get("/api/logistics/status");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.scope).toBe("repository-local");
    expect(response.body.blockedByExternalFrontend).toBe(true);
    expect(response.body.currentTrackId).toBe("logistics_vertical_20260222");
    expect(response.body.followUpTrackId).toBe("logistics_vertical_repo_local_20260407");
    expect(response.body.logisticsAgent.name).toBe("LogisticsDispatcher");
    expect(response.body.logisticsAgent.capabilities).toContain("shipment_tracking");
  });

  it("returns a lightweight capabilities payload", async () => {
    const app = express();
    app.use("/api/logistics", createLogisticsRoutes());

    const response = await request(app).get("/api/logistics/capabilities");

    expect(response.status).toBe(200);
    expect(response.body.capabilities).toContain("route_optimization");
    expect(response.body.currentTrackId).toBe("logistics_vertical_20260222");
  });
});
