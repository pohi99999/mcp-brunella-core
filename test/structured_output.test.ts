import { describe, it, expect } from "vitest";
import { z } from "zod";

// Example of the structured output we expect from agents or config
const AgentResultSchema = z.object({
  status: z.enum(["success", "error", "delegated"]),
  message: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

const ConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  webUiEnabled: z.boolean(),
  logLevel: z.enum(["info", "error", "warn", "debug"]),
});

describe("Structured Output & Schema Validation", () => {
  describe("Agent Result Validation", () => {
    it("should pass valid success result", () => {
      const result = {
        status: "success",
        message: "Task completed",
        data: { id: 123 },
      };
      const parsed = AgentResultSchema.parse(result);
      expect(parsed.status).toBe("success");
    });

    it("should pass valid error result", () => {
      const result = {
        status: "error",
        error: "Something went wrong",
      };
      const parsed = AgentResultSchema.parse(result);
      expect(parsed.status).toBe("error");
    });

    it("should fail on invalid status", () => {
      const result = {
        status: "hallucination",
        message: "I think I did it",
      };
      expect(() => AgentResultSchema.parse(result)).toThrow();
    });
  });

  describe("Config Schema Validation", () => {
    it("should pass valid config", () => {
      const config = {
        port: 3000,
        webUiEnabled: true,
        logLevel: "info",
      };
      const parsed = ConfigSchema.parse(config);
      expect(parsed.port).toBe(3000);
    });

    it("should fail on invalid port", () => {
      const config = {
        port: 80,
        webUiEnabled: true,
        logLevel: "info",
      };
      expect(() => ConfigSchema.parse(config)).toThrow();
    });
  });
});
