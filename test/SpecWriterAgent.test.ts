// FILE: test/specWriterAgent.test.ts
// PURPOSE: Unit tests for SpecWriterAgent v2.0 (EPP v2 Protocol)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpecWriterAgent } from "../src/agents/SpecWriterAgent.js";
import * as llmClient from "../src/core/llm_client.js";
import fs from "fs/promises";
import path from "path";

// Mock LLM client
vi.mock("../src/core/llm_client.js", () => ({
  generateResponse: vi.fn(),
}));

// Mock logger
vi.mock("../src/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

describe("SpecWriterAgent v2.0", () => {
  let agent: SpecWriterAgent;
  const testTracksDir = path.join(
    process.cwd(),
    "conductor",
    "tracks",
    "test-temp",
  );

  beforeEach(() => {
    vi.setConfig({ testTimeout: 30000 });
    agent = new SpecWriterAgent();
    vi.clearAllMocks();
    process.env.BRUNELLA_CONDUCTOR_TRACKS_DIR = testTracksDir;
  });

  afterEach(async () => {
    // Cleanup test tracks
    try {
      await fs.rm(testTracksDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }

    delete process.env.BRUNELLA_CONDUCTOR_TRACKS_DIR;
  });

  describe("Agent Metadata", () => {
    it("should have correct agent properties", () => {
      expect(agent.name).toBe("SpecWriter");
      expect(agent.role).toBe("EPP v2 Track Generator");
      expect(agent.description).toContain("EPP v2 compliant");
      expect(agent.capabilities).toContain("track_generation");
      expect(agent.capabilities).toContain("epp_v2_compliance");
    });
  });

  describe("Stage 1: Requirement Extraction", () => {
    it("should extract structured requirements from natural language idea", async () => {
      const mockRequirements = {
        title: "Test Feature",
        description: "A test feature for unit testing",
        priority: "P1",
        estimated_hours: 5,
        phases: [
          {
            name: "Phase 1: Core",
            tasks: [{ task: "Create component", estimate_minutes: 60 }],
          },
        ],
        integrations: {
          dashboard: "Test dashboard component",
          cli: "Test CLI command",
        },
      };

      vi
        .mocked(llmClient.generateResponse)
        .mockResolvedValueOnce(JSON.stringify(mockRequirements)) // For stage1
        .mockResolvedValueOnce(`
# E2E Test Track Title

**Track ID:** \`test-track-20260211\`
**Priority:** P1
**Progress:** 0%

## 🎯 Cél
Test description

## 📋 Feladatok (TODO)
- [ ] Task 1

## ✅ Acceptance Criteria
- [ ] Dashboard integráció kész (Test dashboard component)
- [ ] CLI integráció kész (Test CLI command)
- [ ] \`npm test\` - All tests passing (0 errors)
- [ ] \`npm run build\` - Clean build (0 TypeScript errors)
- [ ] EPP v2 compliance: 7 Arany Szabály követve
- [ ] Documentation updated (.ai/claude.md + FOSZAL.md)

## 🔗 Integrációk

### Dashboard
Test dashboard component

**Component:** \`src/dashboard/components/[ComponentName].tsx\`

### CLI
Test CLI command

**Command:** \`brunella [command-name]\`
**File:** \`src/cli/[commandName]Commands.ts\`
`); // For stage2 - EPP v2 compliant markdown

      const result = await agent.execute(
        "Generate track from idea: Add user authentication",
        {
          metadata: {
            idea: "Add user authentication with JWT tokens and session management",
          },
        },
      );

      expect(result.status).toBe("success");
      expect(result.error).toBeUndefined(); // Expected to be undefined on success
      expect(llmClient.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining("Extract structured information"),
        "ollama",
        "qwen2.5-coder:latest",
      );
    });

    it("should handle JSON wrapped in markdown code blocks", { timeout: 30000 }, async () => {
      const mockResponse =
        '```json\n{"title":"Test","description":"desc","priority":"P0","estimated_hours":2,"phases":[],"integrations":{"dashboard":"x","cli":"y"}}\n```';

      vi.mocked(llmClient.generateResponse).mockResolvedValueOnce(mockResponse) // For stage1
        .mockResolvedValueOnce(`
# E2E Test Track Title

**Track ID:** \`test-track-20260211\`
**Priority:** P1
**Progress:** 0%

## 🎯 Cél
Test description

## 📋 Feladatok (TODO)
- [ ] Task 1

## ✅ Acceptance Criteria
- [ ] Dashboard integráció kész (Test dashboard component)
- [ ] CLI integráció kész (Test CLI command)
- [ ] \`npm test\` - All tests passing (0 errors)
- [ ] \`npm run build\` - Clean build (0 TypeScript errors)
- [ ] EPP v2 compliance: 7 Arany Szabály követve
- [ ] Documentation updated (.ai/claude.md + FOSZAL.md)

## 🔗 Integrációk

### Dashboard
Test dashboard component

**Component:** \`src/dashboard/components/[ComponentName].tsx\`

### CLI
Test CLI command

**Command:** \`brunella [command-name]\`
**File:** \`src/cli/[commandName]Commands.ts\`
`); // For stage2 - EPP v2 compliant markdown

      const result = await agent.execute("test", {
        metadata: { idea: "Test idea" },
      });

      // Should parse successfully
      expect(result.status).toBe("success");
      expect(result.error).toBeUndefined();
      expect(llmClient.generateResponse).toHaveBeenCalledTimes(2); // Two calls, one for each stage
    });

    it("should return error if idea is missing", async () => {
      const result = await agent.execute("", {
        // Empty task
        metadata: { idea: "" }, // Explicitly empty idea
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe(
        "Missing idea in context.metadata.idea or context.task",
      );
    });
  });

  describe("Stage 2: Track Markdown Generation", () => {
    it("should generate EPP v2 compliant track.md", async () => {
      const mockRequirements = {
        title: "Test Track",
        description: "Test description",
        priority: "P1",
        estimated_hours: 3,
        phases: [
          {
            name: "Phase 1: Setup",
            tasks: [{ task: "Init", estimate_minutes: 30 }],
          },
        ],
        integrations: {
          dashboard: "Dashboard comp",
          cli: "CLI cmd",
        },
      };

      const mockTrackMarkdown = `# Test Track

**Track ID:** \`test-track-20260211\`
**Priority:** P1
**Progress:** 0%

## 🎯 Cél
Test description

## 📋 Feladatok (TODO)
- [ ] Task 1

## ✅ Acceptance Criteria
- [ ] Dashboard integráció kész (Dashboard comp)
- [ ] CLI integráció kész (CLI cmd)
- [ ] \`npm test\` - All tests passing (0 errors)
- [ ] \`npm run build\` - Clean build (0 TypeScript errors)
- [ ] EPP v2 compliance: 7 Arany Szabály követve
- [ ] Documentation updated (.ai/claude.md + FOSZAL.md)

## 🔗 Integrációk

### Dashboard
Dashboard comp

**Component:** \`src/dashboard/components/[ComponentName].tsx\`

### CLI
CLI cmd

**Command:** \`brunella [command-name]\`
**File:** \`src/cli/[commandName]Commands.ts\`
`;

      vi.mocked(llmClient.generateResponse)
        .mockResolvedValueOnce(JSON.stringify(mockRequirements))
        .mockResolvedValueOnce(mockTrackMarkdown);

      const result = await agent.execute("test", {
        metadata: { idea: "Test idea" },
      });

      expect(result.status).toBe("success");
      expect(result.error).toBeUndefined();
      expect(llmClient.generateResponse).toHaveBeenCalledTimes(2);
    });
  });

  describe("Stage 3: Validation & File Write", () => {
    it("should validate EPP v2 compliance (required sections)", async () => {
      const invalidMarkdown = "# Test\n\nNo required sections";

      vi.mocked(llmClient.generateResponse)
        .mockResolvedValueOnce(
          JSON.stringify({
            title: "Test",
            description: "desc",
            priority: "P1",
            estimated_hours: 1,
            phases: [],
            integrations: { dashboard: "x", cli: "y" },
          }),
        )
        .mockResolvedValueOnce(invalidMarkdown);

      const result = await agent.execute("test", {
        metadata: { idea: "Test" },
      });

      expect(result.status).toBe("error");
      expect(result.error).toContain("EPP v2 validation failed");
    });

    it("should enforce Dashboard + CLI integration (Rule #6)", async () => {
      const noDashboardMarkdown = `# Test

## 🎯 Cél
Test

## 📋 Feladatok (TODO)
- [ ] Task

## ✅ Acceptance Criteria
- [ ] Test

## 🔗 Integrációk
Only CLI, no Dashboard
`;

      vi.mocked(llmClient.generateResponse)
        .mockResolvedValueOnce(
          JSON.stringify({
            title: "Test",
            description: "desc",
            priority: "P1",
            estimated_hours: 1,
            phases: [],
            integrations: { dashboard: "x", cli: "y" },
          }),
        )
        .mockResolvedValueOnce(noDashboardMarkdown);

      const result = await agent.execute("test", {
        metadata: { idea: "Test" },
      });

      expect(result.status).toBe("error");
      expect(result.error).toContain("Rule #6");
    });
  });

  describe("listTracks()", () => {
    it("should list all tracks from conductor/tracks/", async () => {
      const result = await agent.listTracks();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("tracks");
      expect(Array.isArray((result.data as any).tracks)).toBe(true);
    });

    it("should extract metadata from track.md files", async () => {
      // Create a test track
      const testTrackDir = path.join(testTracksDir, "test-track-12345678");
      await fs.mkdir(testTrackDir, { recursive: true });

      const trackContent = `# Test Track Title

**Track ID:** \`test-track-12345678\`
**Priority:** P0
**Progress:** 25%
**Created:** 2026-02-11

## 🎯 Cél
Test track for unit testing
`;
      await fs.writeFile(
        path.join(testTrackDir, "track.md"),
        trackContent,
        "utf-8",
      );

      const result = await agent.listTracks();

      expect(result.success).toBe(true);
      const tracks = (result.data as any).tracks;
      const testTrack = tracks.find((t: any) => t.id === "test-track-12345678");

      expect(testTrack).toBeDefined();
      expect(testTrack.title).toContain("Test Track Title");
      expect(testTrack.priority).toBe("P0");
      expect(testTrack.progress).toBe(25);

      // Cleanup
      await fs.rm(testTrackDir, { recursive: true, force: true });
    });
  });

  describe("Integration: Full 3-Stage Pipeline", () => {
    it("should execute full pipeline end-to-end (mocked LLM)", async () => {
      const mockRequirements = {
        title: "E2E Test Track",
        description: "End-to-end test",
        priority: "P2",
        estimated_hours: 2,
        phases: [
          {
            name: "Phase 1: Test",
            tasks: [{ task: "Write test", estimate_minutes: 60 }],
          },
        ],
        integrations: {
          dashboard: "TestComponent.tsx",
          cli: "test command",
        },
      };

      const mockTrackMarkdown = `# E2E Test Track

**Track ID:** \`e2e-test-track-20260211\`
**Priority:** P2

## 🎯 Cél
End-to-end test

## 📋 Feladatok (TODO)
- [ ] Write test

## ✅ Acceptance Criteria
- [ ] Dashboard integráció kész
- [ ] CLI integráció kész

## 🔗 Integrációk
### Dashboard
TestComponent.tsx

### CLI
test command
`;

      vi.mocked(llmClient.generateResponse)
        .mockResolvedValueOnce(JSON.stringify(mockRequirements))
        .mockResolvedValueOnce(mockTrackMarkdown);

      const result = await agent.execute("Generate track", {
        metadata: {
          idea: "Create an E2E test track with dashboard and CLI integration",
        },
      });

      expect(result.status).toBe("success");
      expect(result.data).toHaveProperty("trackId");
      expect(result.data).toHaveProperty("trackMarkdown");
      expect(result.data).toHaveProperty("requirements");
      expect((result.data as any).requirements.title).toBe("E2E Test Track");

      // Verify track file was created
      const trackData = result.data as any;
      const trackExists = await fs
        .access(trackData.trackFile)
        .then(() => true)
        .catch(() => false);
      expect(trackExists).toBe(true);

      // Cleanup
      await fs.rm(path.dirname(trackData.trackFile), {
        recursive: true,
        force: true,
      });
    });
  });
});
