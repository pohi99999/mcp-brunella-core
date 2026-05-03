import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createBrowserCopilotRoutes } from "@apps/mcp-core/server/routes/browserCopilot.js";

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  configure: vi.fn(),
  sendMessage: vi.fn(),
  confirmPending: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@packages/core-logic/BrowserCopilotSessionService.js", () => ({
  browserCopilotSessionService: mocks,
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

describe("Browser Copilot routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockReturnValue({ mode: "guide", enginePreference: "auto" });
    mocks.configure.mockResolvedValue({ mode: "auto", enginePreference: "robotkez", overlayEnabled: true });
    mocks.sendMessage.mockResolvedValue({ mode: "guide", lastInstruction: "Open dashboard" });

    app = express();
    app.use(express.json());
    app.use("/api/browser-copilot", createBrowserCopilotRoutes());
  });

  it("returns current session state", async () => {
    const res = await request(app).get("/api/browser-copilot/session");

    expect(res.status).toBe(200);
    expect(res.body.session).toEqual({ mode: "guide", enginePreference: "auto" });
  });

  it("validates session configuration enums", async () => {
    const res = await request(app)
      .post("/api/browser-copilot/session/configure")
      .send({ mode: "invalid" });

    expect(res.status).toBe(400);
    expect(mocks.configure).not.toHaveBeenCalled();
  });

  it("normalizes valid session configuration payloads", async () => {
    const res = await request(app)
      .post("/api/browser-copilot/session/configure")
      .send({ mode: "auto", enginePreference: "robotkez", overlayEnabled: true });

    expect(res.status).toBe(200);
    expect(mocks.configure).toHaveBeenCalledWith({
      mode: "auto",
      enginePreference: "robotkez",
      overlayEnabled: true,
    });
  });

  it("requires and trims message instructions", async () => {
    const invalid = await request(app)
      .post("/api/browser-copilot/message")
      .send({ instruction: "   " });
    expect(invalid.status).toBe(400);

    const valid = await request(app)
      .post("/api/browser-copilot/message")
      .send({ instruction: "  Open dashboard  " });

    expect(valid.status).toBe(200);
    expect(mocks.sendMessage).toHaveBeenCalledWith("Open dashboard");
  });
});
