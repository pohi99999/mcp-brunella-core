import { describe, it, expect, vi, beforeEach } from "vitest";
import { crawl4aiCrawlHandler, crawl4aiBatchHandler } from "@packages/utils/crawl4aiTool.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("crawl4aiTool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("crawl4aiCrawlHandler", () => {
    it("should return success for valid crawl response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          url: "https://example.com",
          markdown: "# Example",
          status: "success",
        }),
      });

      const result = await crawl4aiCrawlHandler({ url: "https://example.com" });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should handle HTTP errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await crawl4aiCrawlHandler({ url: "https://example.com" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const result = await crawl4aiCrawlHandler({ url: "https://example.com" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    });

    it("should pass extract_schema as JSON", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          url: "https://example.com",
          markdown: "# Test",
          status: "success",
          extracted_data: { title: "Test" },
        }),
      });

      const schema = JSON.stringify({ title: { type: "string" } });
      await crawl4aiCrawlHandler({
        url: "https://example.com",
        extract_schema: schema,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/crawl4ai/crawl"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("extract_schema"),
        }),
      );
    });
  });

  describe("crawl4aiBatchHandler", () => {
    it("should return batch results", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { url: "https://a.com", markdown: "A", status: "success" },
            { url: "https://b.com", markdown: "B", status: "success" },
          ],
        }),
      });

      const result = await crawl4aiBatchHandler({
        urls: ["https://a.com", "https://b.com"],
      });
      expect(result.success).toBe(true);
      expect((result.data as { results: unknown[] }).results).toHaveLength(2);
    });

    it("should handle batch errors", async () => {
      mockFetch.mockRejectedValue(new Error("Timeout"));

      const result = await crawl4aiBatchHandler({ urls: ["https://a.com"] });
      expect(result.success).toBe(false);
    });
  });
});
