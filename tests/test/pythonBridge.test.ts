import { describe, it, expect } from "vitest";
import {
  CrawlResultSchema,
  ExecuteResultSchema,
  HarvestResultSchema,
  RefineResultSchema,
  validatePythonResponse,
  parseAndValidate,
} from "@packages/utils/pythonBridge.js";

describe("pythonBridge Zod schemas", () => {
  describe("ExecuteResultSchema", () => {
    it("should validate correct execute result", () => {
      const data = { stdout: "hello world" };
      const result = ExecuteResultSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate execute result with error", () => {
      const data = { stdout: "", error: "SyntaxError: invalid syntax" };
      const result = ExecuteResultSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error).toBe("SyntaxError: invalid syntax");
      }
    });

    it("should reject missing stdout", () => {
      const data = { error: "fail" };
      const result = ExecuteResultSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("CrawlResultSchema", () => {
    it("should validate crawl result", () => {
      const data = {
        url: "https://example.com",
        markdown: "# Hello",
        status: "success",
      };
      const result = CrawlResultSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate crawl result with optional fields", () => {
      const data = {
        url: "https://example.com",
        markdown: "# Hello",
        status: "success",
        extracted_data: { title: "Test" },
        links: ["https://example.com/about"],
        error: null,
      };
      const result = CrawlResultSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("HarvestResultSchema", () => {
    it("should validate harvest result", () => {
      const data = { status: "ok", data: [{ url: "https://example.com" }] };
      const result = HarvestResultSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate harvest result with result payload from FastAPI", () => {
      const data = { status: "ok", result: { finished: true } };
      const result = HarvestResultSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("RefineResultSchema", () => {
    it("should validate refine result", () => {
      const data = { status: "ok", refined: { clean: true } };
      const result = RefineResultSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("validatePythonResponse", () => {
    it("should return success for valid data", () => {
      const data = { stdout: "test" };
      const result = validatePythonResponse(ExecuteResultSchema, data, "/execute");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stdout).toBe("test");
      }
    });

    it("should return error for invalid data", () => {
      const data = { wrong_field: "test" };
      const result = validatePythonResponse(ExecuteResultSchema, data, "/execute");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("parseAndValidate", () => {
    it("should parse JSON string and validate", () => {
      const json = '{"stdout": "hello"}';
      const result = parseAndValidate(ExecuteResultSchema, json, "test");
      expect(result.success).toBe(true);
    });

    it("should return error for invalid JSON", () => {
      const json = "not json";
      const result = parseAndValidate(ExecuteResultSchema, json, "test");
      expect(result.success).toBe(false);
    });

    it("should return error for valid JSON with wrong schema", () => {
      const json = '{"wrong": true}';
      const result = parseAndValidate(ExecuteResultSchema, json, "test");
      expect(result.success).toBe(false);
    });
  });
});
