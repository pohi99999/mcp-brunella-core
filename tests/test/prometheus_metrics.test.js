import { beforeEach, describe, expect, it } from "vitest";
import { getPrometheusMetrics, initMetrics, recordAgentExecution, recordHttpRequest, recordLlmUsageAndCost, resetPrometheusMetricsForTests, } from "@packages/utils/metrics.js";
describe("prometheus metrics", () => {
    beforeEach(async () => {
        initMetrics();
        await resetPrometheusMetricsForTests();
    });
    it("records HTTP request metrics", async () => {
        recordHttpRequest("GET", "/api/memory/123", 200, 145);
        const output = await getPrometheusMetrics();
        expect(output).toContain("http_requests_total");
        expect(output).toContain('path="/api/memory/:id"');
        expect(output).toContain("http_request_duration_seconds");
    });
    it("records agent execution metrics", async () => {
        recordAgentExecution("Developer", "success", 820);
        const output = await getPrometheusMetrics();
        expect(output).toContain("agent_executions_total");
        expect(output).toContain('agent_name="Developer"');
        expect(output).toContain('status="success"');
        expect(output).toContain("agent_execution_seconds");
    });
    it("records LLM token and cost metrics", async () => {
        recordLlmUsageAndCost({
            provider: "github",
            model: "gpt-4o",
            prompt: "hello world",
            completion: "here is a generated answer with enough text",
        });
        const output = await getPrometheusMetrics();
        expect(output).toContain("llm_tokens_total");
        expect(output).toContain('provider="github"');
        expect(output).toContain('model="gpt-4o"');
        expect(output).toContain("llm_cost_usd_total");
    });
});
