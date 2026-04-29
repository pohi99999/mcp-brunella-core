// FILE: test/telemetry.test.ts
// PURPOSE: Ellenőrzi a LangSmith tracer inicializálását.
import { describe, it, expect } from "vitest";
import { getTracer } from "@packages/utils/telemetry";
describe("Telemetry Test", () => {
    it("should initialize LangChain tracer", () => {
        const tracer = getTracer("test-project");
        expect(tracer).toBeDefined();
        expect(tracer.projectName).toBe("test-project");
    });
});
