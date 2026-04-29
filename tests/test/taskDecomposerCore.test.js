import { describe, it, expect } from "vitest";
import { decomposePreview, detectCycle, } from "@packages/agents/taskDecomposerCore.js";
describe("taskDecomposerCore", () => {
    it("decomposePreview creates at least one microtask", () => {
        const r = decomposePreview("Create API route. Add tests.");
        expect(r.tasks.length).toBeGreaterThanOrEqual(1);
        expect(r.dag.nodes.length).toBe(r.tasks.length);
    });
    it("defaults to sequential dependencies", () => {
        const r = decomposePreview("Step one. Step two. Step three.");
        expect(r.tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
        expect(r.tasks[0].dependencies).toEqual([]);
        expect(r.tasks[1].dependencies).toEqual(["t1"]);
        expect(r.tasks[2].dependencies).toEqual(["t2"]);
    });
    it("detectCycle returns null for a normal chain", () => {
        const tasks = [
            {
                id: "t1",
                agent: "Developer",
                task: "a",
                dependencies: [],
                parallel: false,
                retries: 1,
                timeoutMs: 1000,
            },
            {
                id: "t2",
                agent: "Developer",
                task: "b",
                dependencies: ["t1"],
                parallel: false,
                retries: 1,
                timeoutMs: 1000,
            },
        ];
        expect(detectCycle(tasks)).toBeNull();
    });
    it("detectCycle finds a simple cycle", () => {
        const tasks = [
            {
                id: "t1",
                agent: "Developer",
                task: "a",
                dependencies: ["t2"],
                parallel: false,
                retries: 1,
                timeoutMs: 1000,
            },
            {
                id: "t2",
                agent: "Developer",
                task: "b",
                dependencies: ["t1"],
                parallel: false,
                retries: 1,
                timeoutMs: 1000,
            },
        ];
        const cycle = detectCycle(tasks);
        expect(cycle).not.toBeNull();
        expect(cycle?.join(" ")).toContain("t1");
        expect(cycle?.join(" ")).toContain("t2");
    });
});
