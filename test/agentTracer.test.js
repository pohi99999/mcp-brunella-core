// FILE: test/agentTracer.test.ts
// PURPOSE: G5.4 — Tests for Agent Delegation Tracer (RULE-OB1→OB4)
import { describe, it, expect, beforeEach } from 'vitest';
import { startSpan, endSpan, traceAgentExecution, traceLLMCall, getTraceSpans, getRecentSpans, getActiveSpans, getTokenUsageSummary, getRecentTraceIds, getTracerStats, clearAllSpans, } from '../src/utils/agentTracer.js';
describe('agentTracer', () => {
    beforeEach(() => {
        clearAllSpans();
    });
    // ==========================================================================
    // RULE-OB1: Every agent execute = TraceSpan
    // ==========================================================================
    describe('startSpan / endSpan', () => {
        it('creates a span with unique traceId and spanId', () => {
            const span = startSpan('Developer', 'execute');
            expect(span.traceId).toBeDefined();
            expect(span.spanId).toBeDefined();
            expect(span.agentName).toBe('Developer');
            expect(span.operation).toBe('execute');
            expect(span.status).toBe('running');
            expect(span.startTime).toBeGreaterThan(0);
            expect(span.endTime).toBeUndefined();
        });
        it('endSpan sets duration, status, and endTime', () => {
            const span = startSpan('Developer', 'execute');
            const ended = endSpan(span, 'success');
            expect(ended.endTime).toBeGreaterThanOrEqual(ended.startTime);
            expect(ended.duration).toBeDefined();
            expect(ended.duration).toBeGreaterThanOrEqual(0);
            expect(ended.status).toBe('success');
        });
        it('endSpan records error details', () => {
            const span = startSpan('Developer', 'execute');
            const ended = endSpan(span, 'error', undefined, undefined, 'Something broke');
            expect(ended.status).toBe('error');
            expect(ended.error).toBe('Something broke');
        });
        it('endSpan attaches token usage (RULE-OB3)', () => {
            const span = startSpan('LLM', 'llm_call', undefined, { model: 'gpt-4o' });
            const ended = endSpan(span, 'success', undefined, { input: 100, output: 50 });
            expect(ended.tokenUsage).toEqual({ input: 100, output: 50 });
        });
        it('span creation < 2ms (performance)', () => {
            const start = performance.now();
            for (let i = 0; i < 100; i++) {
                const s = startSpan('Perf', 'test');
                endSpan(s, 'success');
            }
            const elapsed = performance.now() - start;
            // 100 start+end cycles in < 200ms → < 2ms each
            expect(elapsed).toBeLessThan(200);
        });
    });
    // ==========================================================================
    // RULE-OB2: Orchestrator delegation = parent-child span relationship
    // ==========================================================================
    describe('parent-child spans', () => {
        it('child span inherits traceId from parent context', () => {
            const parent = startSpan('Orchestrator', 'plan');
            const parentCtx = { traceId: parent.traceId, spanId: parent.spanId };
            const child = startSpan('Developer', 'execute', parentCtx);
            expect(child.traceId).toBe(parent.traceId);
            expect(child.parentSpanId).toBe(parent.spanId);
            expect(child.spanId).not.toBe(parent.spanId);
        });
        it('getTraceSpans returns both parent and child', () => {
            const parent = startSpan('Orchestrator', 'plan');
            const parentCtx = { traceId: parent.traceId, spanId: parent.spanId };
            const child = startSpan('Developer', 'execute', parentCtx);
            endSpan(child, 'success');
            endSpan(parent, 'success');
            const spans = getTraceSpans(parent.traceId);
            expect(spans).toHaveLength(2);
            expect(spans.map(s => s.agentName)).toContain('Orchestrator');
            expect(spans.map(s => s.agentName)).toContain('Developer');
        });
    });
    // ==========================================================================
    // Convenience helpers
    // ==========================================================================
    describe('traceAgentExecution', () => {
        it('returns span, context, and end helper', () => {
            const { span, context, end } = traceAgentExecution('Evaluator', 'run tests');
            expect(span.agentName).toBe('Evaluator');
            expect(span.operation).toBe('execute');
            expect(context.traceId).toBe(span.traceId);
            expect(context.spanId).toBe(span.spanId);
            const ended = end('success');
            expect(ended.status).toBe('success');
        });
        it('supports parent context for delegation chain', () => {
            const parent = traceAgentExecution('Orchestrator', 'plan');
            const child = traceAgentExecution('Developer', 'code', parent.context);
            expect(child.span.traceId).toBe(parent.span.traceId);
            expect(child.span.parentSpanId).toBe(parent.span.spanId);
            child.end('success');
            parent.end('success');
        });
    });
    describe('traceLLMCall', () => {
        it('creates LLM span with model metadata', () => {
            const { span, end } = traceLLMCall('Developer', 'gpt-4o', 'github');
            expect(span.operation).toBe('llm_call');
            expect(span.metadata.model).toBe('gpt-4o');
            expect(span.metadata.provider).toBe('github');
            const ended = end('success', { input: 200, output: 100 });
            expect(ended.tokenUsage).toEqual({ input: 200, output: 100 });
        });
    });
    // ==========================================================================
    // Query functions
    // ==========================================================================
    describe('query functions', () => {
        it('getRecentSpans returns completed spans in reverse order', () => {
            const s1 = startSpan('A', 'op1');
            endSpan(s1, 'success');
            const s2 = startSpan('B', 'op2');
            endSpan(s2, 'success');
            const recent = getRecentSpans(10);
            expect(recent).toHaveLength(2);
            expect(recent[0].agentName).toBe('B'); // Most recent first
        });
        it('getActiveSpans returns only running spans', () => {
            const s1 = startSpan('A', 'op1');
            startSpan('B', 'op2');
            endSpan(s1, 'success');
            const active = getActiveSpans();
            expect(active).toHaveLength(1);
            expect(active[0].agentName).toBe('B');
        });
        it('getTokenUsageSummary aggregates by agent and model', () => {
            const s1 = startSpan('Dev', 'llm_call', undefined, { model: 'gpt-4o' });
            endSpan(s1, 'success', undefined, { input: 100, output: 50 });
            const s2 = startSpan('Dev', 'llm_call', undefined, { model: 'gpt-4o' });
            endSpan(s2, 'success', undefined, { input: 200, output: 100 });
            const s3 = startSpan('Eval', 'llm_call', undefined, { model: 'llama3.1:8b' });
            endSpan(s3, 'success', undefined, { input: 50, output: 25 });
            const summary = getTokenUsageSummary();
            expect(summary.totalInput).toBe(350);
            expect(summary.totalOutput).toBe(175);
            expect(summary.byAgent['Dev']).toEqual({ input: 300, output: 150 });
            expect(summary.byAgent['Eval']).toEqual({ input: 50, output: 25 });
            expect(summary.byModel['gpt-4o']).toEqual({ input: 300, output: 150 });
        });
        it('getRecentTraceIds returns unique trace IDs', () => {
            const s1 = startSpan('A', 'op');
            endSpan(s1, 'success');
            const s2 = startSpan('B', 'op', { traceId: s1.traceId, spanId: s1.spanId });
            endSpan(s2, 'success');
            const s3 = startSpan('C', 'op'); // Different trace
            endSpan(s3, 'success');
            const ids = getRecentTraceIds(10);
            expect(ids).toHaveLength(2);
        });
        it('getTracerStats returns correct counts', () => {
            startSpan('A', 'op'); // active
            const s2 = startSpan('B', 'op');
            endSpan(s2, 'success'); // completed
            const stats = getTracerStats();
            expect(stats.activeSpans).toBe(1);
            expect(stats.completedSpans).toBe(1);
        });
    });
    // ==========================================================================
    // Housekeeping
    // ==========================================================================
    describe('clearAllSpans', () => {
        it('resets all state', () => {
            startSpan('A', 'op'); // leave active
            const s2 = startSpan('B', 'op');
            endSpan(s2, 'success');
            clearAllSpans();
            expect(getActiveSpans()).toHaveLength(0);
            expect(getRecentSpans(100)).toHaveLength(0);
            expect(getTracerStats().activeSpans).toBe(0);
            expect(getTracerStats().completedSpans).toBe(0);
        });
    });
});
