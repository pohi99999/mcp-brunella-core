import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { config } from "../src/config/index.js";
describe("SwarmCoordinator Durable Object", () => {
    const workerSrcDir = path.resolve(config.workspaceRoot, "bas-cloudflare-orchestrator", "src");
    const coordinatorPath = path.join(workerSrcDir, "swarmCoordinator.ts");
    const indexPath = path.join(workerSrcDir, "index.ts");
    const wranglerPath = path.resolve(config.workspaceRoot, "bas-cloudflare-orchestrator", "wrangler.jsonc");
    describe("swarmCoordinator.ts module", () => {
        it("should exist as a file", () => {
            expect(fs.existsSync(coordinatorPath)).toBe(true);
        });
        it("should export SwarmCoordinator class implementing DurableObject", () => {
            const content = fs.readFileSync(coordinatorPath, "utf-8");
            expect(content).toContain("export class SwarmCoordinator");
            expect(content).toContain("implements DurableObject");
        });
        it("should define SwarmSession interface with required fields", () => {
            const content = fs.readFileSync(coordinatorPath, "utf-8");
            expect(content).toContain("interface SwarmSession");
            expect(content).toContain("sessionId: string");
            expect(content).toContain("activeAgent: string");
            expect(content).toContain("history:");
            expect(content).toContain("artifacts:");
            expect(content).toContain("handoffs:");
        });
        it("should handle /swarm/create endpoint", () => {
            const content = fs.readFileSync(coordinatorPath, "utf-8");
            expect(content).toContain('"/swarm/create"');
            expect(content).toContain("session_created");
        });
        it("should handle handoff endpoint", () => {
            const content = fs.readFileSync(coordinatorPath, "utf-8");
            expect(content).toContain('"handoff"');
            expect(content).toContain("targetAgent");
        });
        it("should handle artifact endpoint", () => {
            const content = fs.readFileSync(coordinatorPath, "utf-8");
            expect(content).toContain('"artifact"');
            expect(content).toContain("artifact_stored");
        });
        it("should support WebSocket upgrade for real-time events", () => {
            const content = fs.readFileSync(coordinatorPath, "utf-8");
            expect(content).toContain("WebSocketPair");
            expect(content).toContain("acceptWebSocket");
            expect(content).toContain("broadcast");
        });
        it("should persist sessions to Durable Object storage", () => {
            const content = fs.readFileSync(coordinatorPath, "utf-8");
            expect(content).toContain("this.state.storage.put");
            expect(content).toContain("this.state.storage.get");
        });
    });
    describe("Worker index.ts integration", () => {
        it("should re-export SwarmCoordinator from index.ts", () => {
            const content = fs.readFileSync(indexPath, "utf-8");
            expect(content).toContain('export { SwarmCoordinator } from "./swarmCoordinator.js"');
        });
        it("should have SWARM_COORDINATOR in Env interface", () => {
            const content = fs.readFileSync(indexPath, "utf-8");
            expect(content).toContain("SWARM_COORDINATOR: DurableObjectNamespace");
        });
        it("should route /swarm/* to Durable Object", () => {
            const content = fs.readFileSync(indexPath, "utf-8");
            expect(content).toContain('path.startsWith("/swarm")');
            expect(content).toContain("SWARM_COORDINATOR.idFromName");
            expect(content).toContain("stub.fetch(request)");
        });
        it("should list swarm endpoints in health check", () => {
            const content = fs.readFileSync(indexPath, "utf-8");
            expect(content).toContain("swarmCreate");
            expect(content).toContain("swarmHandoff");
            expect(content).toContain("swarmArtifact");
        });
    });
    describe("wrangler.jsonc configuration", () => {
        it("should contain durable_objects binding for SwarmCoordinator", () => {
            const content = fs.readFileSync(wranglerPath, "utf-8");
            expect(content).toContain('"SWARM_COORDINATOR"');
            expect(content).toContain('"SwarmCoordinator"');
            expect(content).toContain("durable_objects");
        });
        it("should define a migration tag for the DO class", () => {
            const content = fs.readFileSync(wranglerPath, "utf-8");
            expect(content).toContain("migrations");
            expect(content).toContain("new_classes");
        });
    });
});
