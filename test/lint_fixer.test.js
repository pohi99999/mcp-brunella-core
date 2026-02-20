import { describe, it, expect, beforeAll } from "vitest";
import LintFixerAgent from "../src/agents/LintFixerAgent.js";
describe("LintFixerAgent", () => {
    let agent;
    beforeAll(() => {
        agent = new LintFixerAgent();
    });
    it("should have correct metadata", () => {
        expect(agent.name).toBe("LintFixer");
        expect(agent.role).toContain("Karbantartó");
        expect(agent.capabilities).toContain("lint_check");
        expect(agent.capabilities).toContain("auto_fix");
    });
    it('should run lint check on "check" command', async () => {
        const result = await agent.execute("check src/");
        expect(result).toBeDefined();
        expect(result.status).toBe("success");
        expect(result.data).toBeDefined();
        // Lehet hiba vagy nincs - mindkettő valid
        expect(result.data.report || result.data.message).toBeDefined();
    }, 60000);
    it("should run lint check on Hungarian command", async () => {
        const result = await agent.execute("ellenőrizd a kódot");
        expect(result).toBeDefined();
        expect(result.status).toBe("success");
    }, 60000);
    it("should detect file path in task", async () => {
        const result = await agent.execute('check "src/cli.ts"');
        expect(result).toBeDefined();
        expect(result.status).toBe("success");
    }, 60000);
    it('should run TypeScript check on "type" command', async () => {
        const result = await agent.execute("type check");
        expect(result).toBeDefined();
        expect(result.status).toBe("success");
        expect(result.data).toBeDefined();
    }, 60000);
    it("should generate fix suggestions", async () => {
        const result = await agent.execute("suggest fix for src/cli.ts");
        expect(result).toBeDefined();
        expect(result.status).toBe("success");
        expect(result.data).toBeDefined();
        // Ha nincs hiba, azt is elfogadjuk
        expect(result.data.message).toBeDefined();
    }, 60000);
    it("should handle non-existent file gracefully", async () => {
        const result = await agent.execute('fix "nonexistent-file-12345.ts"');
        expect(result).toBeDefined();
        // Vagy error mert nincs a fájl, vagy success mert fixAll futott
        expect(["success", "error"]).toContain(result.status);
    });
});
