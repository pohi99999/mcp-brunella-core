// FILE: test/telemetry.test.ts
// PURPOSE: Ellenőrzi a LangSmith tracer inicializálását.
import { getTracer } from "../src/utils/telemetry";
describe("Telemetry Test", () => {
    it("should initialize LangChain tracer", () => {
        const tracer = getTracer("test-project");
        expect(tracer).toBeDefined();
        expect(tracer.projectName).toBe("test-project");
    });
});
