/**
 * LLM Planner Unit Tests
 *
 * Test Coverage:
 * - Valid LLM response parsing
 * - Invalid JSON handling
 * - Plan structure validation
 * - Error handling (LLM hallucination, malformed JSON)
 *
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 3 - LLM Planning Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateExecutionPlan, validateExecutionPlan, ExecutionPlan } from '../src/utils/llmPlanner.js';
import * as llmClient from '../src/core/llm_client.js';

const mockDecision = {
    model: {
        name: 'test-model',
        provider: 'ollama',
        role: 'brain',
        contextWindow: 4096,
        costPerToken: 0,
        speed: 'fast',
        strengths: []
    },
    reason: 'test',
    timestamp: Date.now()
};

// Mock llm_client
vi.mock('../src/core/llm_client.js', () => ({
    generateRouted: vi.fn()
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn()
}));

describe('LLM Planner (Phase 3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateExecutionPlan - Valid Plans', () => {
        it('should generate valid plan for simple navigation', async () => {
            const mockPlan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://google.com', description: 'Google megnyitása' },
                    { action: 'wait', selector: 'input[name="q"]', timeout: 3000, description: 'Keresőmező betöltésre vár' }
                ],
                estimatedDuration: 10000,
                requiresUserInput: [],
                backgroundEligible: false,
                contextNeeded: []
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(mockPlan),
                decision: mockDecision
            });

            const plan = await generateExecutionPlan('Keress rá az AI hírekre');

            expect(plan.plan).toHaveLength(2);
            expect(plan.plan[0].action).toBe('navigate');
            expect(plan.plan[0].url).toBe('https://google.com');
            expect(plan.plan[1].action).toBe('wait');
            expect(plan.estimatedDuration).toBe(10000);
        });

        it('should handle multi-step complex workflow', async () => {
            const mockPlan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://example.com', description: 'Példa oldal' },
                    { action: 'wait', selector: '.content', timeout: 5000, description: 'Tartalom betöltés' },
                    { action: 'click', selector: '.button', description: 'Gomb kattintás' },
                    { action: 'type', selector: 'input#name', text: 'Test User', description: 'Név beírás' },
                    { action: 'screenshot', description: 'Képernyőkép' }
                ],
                estimatedDuration: 20000,
                requiresUserInput: [],
                backgroundEligible: false
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(mockPlan),
                decision: mockDecision
            });

            const plan = await generateExecutionPlan('Tölts ki egy form-ot');

            expect(plan.plan).toHaveLength(5);
            expect(plan.plan[3].action).toBe('type');
            expect(plan.plan[3].text).toBe('Test User');
        });

        it('should handle JSON with markdown code fences', async () => {
            const mockPlan: ExecutionPlan = {
                plan: [{ action: 'navigate', url: 'https://test.com', description: 'Teszt' }],
                estimatedDuration: 5000,
                requiresUserInput: [],
                backgroundEligible: false
            };

            const markdownResponse = '```json\n' + JSON.stringify(mockPlan) + '\n```';
            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: markdownResponse,
                decision: mockDecision
            });

            const plan = await generateExecutionPlan('Test');

            expect(plan.plan).toHaveLength(1);
        });

        it('should set default estimatedDuration if missing', async () => {
            const mockPlan = {
                plan: [
                    { action: 'navigate', url: 'https://google.com', description: 'Google' },
                    { action: 'screenshot', description: 'Screenshot' }
                ],
                // estimatedDuration missing
                requiresUserInput: [],
                backgroundEligible: false
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(mockPlan),
                decision: mockDecision
            });

            const plan = await generateExecutionPlan('Test');

            // Should default to plan.length * 3000
            expect(plan.estimatedDuration).toBe(6000); // 2 steps * 3000ms
        });

        it('should auto-calculate backgroundEligible based on duration', async () => {
            const mockPlan = {
                plan: [{ action: 'navigate', url: 'https://test.com', description: 'Test' }],
                estimatedDuration: 35000, // > 30s
                requiresUserInput: []
                // backgroundEligible missing
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(mockPlan),
                decision: mockDecision
            });

            const plan = await generateExecutionPlan('Long task');

            expect(plan.backgroundEligible).toBe(true); // Auto-set to true
        });
    });

    describe('generateExecutionPlan - Error Handling', () => {
        it('should throw on invalid JSON from LLM', async () => {
            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: 'This is not valid JSON at all',
                decision: mockDecision
            });

            await expect(generateExecutionPlan('Test')).rejects.toThrow(
                /Invalid JSON from LLM|No valid JSON object found/i
            );
        });

        it('should throw on missing plan array', async () => {
            const malformedPlan = {
                // plan field missing
                estimatedDuration: 10000
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(malformedPlan),
                decision: mockDecision
            });

            await expect(generateExecutionPlan('Test')).rejects.toThrow('Invalid plan structure');
        });

        it('should throw on empty plan array', async () => {
            const emptyPlan = {
                plan: [], // Empty array
                estimatedDuration: 0,
                backgroundEligible: false
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(emptyPlan),
                decision: mockDecision
            });

            await expect(generateExecutionPlan('Test')).rejects.toThrow('Invalid plan: empty plan array');
        });

        it('should throw if step is missing action', async () => {
            const invalidPlan = {
                plan: [
                    { url: 'https://test.com', description: 'Missing action field' } // No action
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(invalidPlan),
                decision: mockDecision
            });

            await expect(generateExecutionPlan('Test')).rejects.toThrow('missing action');
        });

        it('should add default description if missing', async () => {
            const planWithoutDesc = {
                plan: [
                    { action: 'navigate', url: 'https://test.com' } // No description
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            vi.spyOn(llmClient, 'generateRouted').mockResolvedValue({
                response: JSON.stringify(planWithoutDesc),
                decision: mockDecision
            });

            const plan = await generateExecutionPlan('Test');

            expect(plan.plan[0].description).toBeDefined();
            expect(plan.plan[0].description).toContain('Lépés 1');
        });

        it('should propagate LLM client errors', async () => {
            vi.spyOn(llmClient, 'generateRouted').mockRejectedValue(new Error('LLM service unavailable'));

            await expect(generateExecutionPlan('Test')).rejects.toThrow('LLM service unavailable');
        });
    });

    describe('validateExecutionPlan', () => {
        it('should validate correct plan', () => {
            const validPlan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Test' },
                    { action: 'click', selector: '.button', description: 'Click' }
                ],
                estimatedDuration: 10000,
                backgroundEligible: false
            };

            expect(() => validateExecutionPlan(validPlan)).not.toThrow();
        });

        it('should throw on unknown action', () => {
            const invalidPlan = {
                plan: [
                    { action: 'invalid_action', description: 'Unknown' } as any
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            expect(() => validateExecutionPlan(invalidPlan)).toThrow('unknown action');
        });

        it('should throw if navigate action missing url', () => {
            const invalidPlan = {
                plan: [
                    { action: 'navigate', description: 'Missing URL' } as any
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            expect(() => validateExecutionPlan(invalidPlan)).toThrow('navigate requires "url"');
        });

        it('should throw if click action missing selector', () => {
            const invalidPlan = {
                plan: [
                    { action: 'click', description: 'Missing selector' } as any
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            expect(() => validateExecutionPlan(invalidPlan)).toThrow('click requires "selector"');
        });

        it('should throw if type action missing selector or text', () => {
            const invalidPlan1 = {
                plan: [
                    { action: 'type', text: 'Hello', description: 'Missing selector' } as any
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            expect(() => validateExecutionPlan(invalidPlan1)).toThrow('type requires "selector" and "text"');

            const invalidPlan2 = {
                plan: [
                    { action: 'type', selector: 'input', description: 'Missing text' } as any
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            expect(() => validateExecutionPlan(invalidPlan2)).toThrow('type requires "selector" and "text"');
        });

        it('should allow screenshot and scroll without extra fields', () => {
            const validPlan: ExecutionPlan = {
                plan: [
                    { action: 'screenshot', description: 'Screenshot' },
                    { action: 'scroll', description: 'Scroll down' }
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            expect(() => validateExecutionPlan(validPlan)).not.toThrow();
        });
    });
});
