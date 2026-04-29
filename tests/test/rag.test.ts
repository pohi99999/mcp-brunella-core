// test/rag.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { HybridMemory } from "@packages/utils/rag.js";

const TEST_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe("RAG Vector Search", () => {
  let tempDir: string;
  let memory: HybridMemory;

  beforeAll(async () => {
    // Create a temporary directory for the vector DB
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-test-"));
    const dbPath = path.join(tempDir, "lancedb");
    memory = new HybridMemory(dbPath);
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should index and retrieve documents using vector similarity", async () => {
    const ollamaUp = await isOllamaAvailable();
    if (!ollamaUp) {
      console.log("⚠️ Ollama not running — skipping RAG vector test");
      return;
    }

    try {
      // 1. Add some documents
      await memory.addDocument("The sky is usually blue during the day.", {
        id: "doc1",
        category: "nature",
      });
      await memory.addDocument("Apples are red or green fruits.", {
        id: "doc2",
        category: "food",
      });
      await memory.addDocument("Python is a popular programming language.", {
        id: "doc3",
        category: "tech",
      });

      // Wait a bit to ensure indexing (LanceDB is usually fast but good to be safe)
      await new Promise((r) => setTimeout(r, 500));

      // 2. Search for related concepts
      const results = await memory.search("sky color", 1);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].text).toContain("blue");
      expect(results[0].score).toBeDefined();

      // 3. Search for something else
      const foodResults = await memory.search("fruit", 1);
      expect(foodResults.length).toBeGreaterThan(0);
      expect(foodResults[0].text).toContain("Apples");
    } catch (error) {
      console.error("RAG test error:", error);
      throw error;
    }
  }, 40000); // Increased timeout to 40 seconds for slow embedding generation
});
