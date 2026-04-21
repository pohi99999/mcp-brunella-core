import { describe, expect, it } from "vitest";
import { swaggerSpec } from "../src/server/swagger.js";
describe("swaggerSpec", () => {
    it("includes metrics endpoint documentation", () => {
        const paths = swaggerSpec.paths;
        expect(paths).toBeDefined();
        expect(paths).toHaveProperty("/metrics");
    });
    it("includes route-level docs from server/routes files", () => {
        const paths = swaggerSpec.paths;
        expect(paths).toBeDefined();
        expect(paths).toHaveProperty("/api/health");
    });
});
