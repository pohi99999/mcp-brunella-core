/**
 * LLM-based Execution Plan Generator
 *
 * Converts magyar természetes nyelvű utasításokat multi-step execution plan-ekké
 * Ollama/Gemini LLM segítségével
 *
 * @author Claude Code + Pohánka Péter
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 3 - LLM Planning Integration
 */

import { generateResponse } from '../core/llm_client.js';
import { logInfo, logWarn, logError } from './logger.js';

/**
 * Execution Plan Interface
 * LLM generates this structure from user instruction
 */
export interface ExecutionPlan {
    plan: ExecutionStep[];
    estimatedDuration: number;
    requiresUserInput?: string[];
    backgroundEligible: boolean;
    contextNeeded?: string[];
}

/**
 * Execution Step Interface
 * Single atomic browser operation
 */
export interface ExecutionStep {
    action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract';
    selector?: string;
    url?: string;
    text?: string;
    timeout?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: number;
    type?: 'text' | 'attribute' | 'html';
    attribute?: string;
    description: string; // Magyar nyelvű leírás (pl. "Menü megnyitása")
}

/**
 * System Prompt Template
 * Instructs LLM on how to generate execution plans
 */
const SYSTEM_PROMPT = `Te egy intelligens böngésző ügynök vagy, hasonló a Perplexity Comet-hez.
A felhasználó magyar nyelvű utasítást ad, te pedig részletes lépésekre bontod.

ELÉRHETŐ MŰVELETEK:
- navigate(url): Navigálás URL-re
- click(selector): Kattintás CSS selector alapján (pl. ".button", "#submit", "a.link")
- type(selector, text): Szöveg gépelés input mezőbe
- scroll(direction, amount): Görgetés (direction: up/down/left/right, amount: pixels)
- wait(selector, timeout): Várakozás elem megjelenésére (timeout ms-ben)
- screenshot(): Képernyőkép készítés
- extract(selector, type): Adat kinyerés (type: text/attribute/html)

SZABÁLYOK:
1. Minden lépésnek legyen magyar description (pl. "Google megnyitása")
2. Használj wait()-et oldal betöltés után (selector: tipikusan első interaktív elem)
3. CSS selectorok legyenek pontosak (használj ID-t, class-t vagy attribute selector-okat)
4. Estimated duration legyen reális (ms-ben, átlagosan 2-5s/lépés)
5. Ha user input kell (cím, jelszó, stb.), add hozzá a requiresUserInput array-hez
6. backgroundEligible: true ha > 30s várható időtartam
7. Minden navigate után használj wait()-et hogy biztos legyen hogy betöltött az oldal

VÁLASZ FORMÁTUM (CSAK JSON, semmi más):
{
  "plan": [
    { "action": "navigate", "url": "https://example.com", "description": "Példa oldal megnyitása" },
    { "action": "wait", "selector": "h1", "timeout": 3000, "description": "Főcím betöltésre vár" },
    { "action": "click", "selector": ".button", "description": "Gomb megnyomása" }
  ],
  "estimatedDuration": 10000,
  "requiresUserInput": [],
  "backgroundEligible": false,
  "contextNeeded": []
}

FONTOS: Csak valid JSON-t adj vissza, semmi más szöveget!`;

/**
 * Generate Execution Plan from magyar instruction
 *
 * @param instruction - Magyar nyelvű utasítás (pl. "Keress rá az AI hírekre")
 * @returns ExecutionPlan - Multi-step browser automation plan
 * @throws Error if LLM response is invalid or cannot be parsed
 */
export async function generateExecutionPlan(instruction: string): Promise<ExecutionPlan> {
    logInfo('LLMPlanner', `Generating plan for: "${instruction}"`);

    const userPrompt = `Utasítás: ${instruction}

Készíts részletes execution plan-t a fenti utasítás végrehajtásához.`;

    try {
        // Call LLM (Ollama by default, falls back automatically)
        const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
        const response = await generateResponse(fullPrompt, 'ollama');

        logInfo('LLMPlanner', `Raw LLM response: ${response.slice(0, 200)}...`);

        // Clean up response (remove markdown code fences if present)
        const cleaned = response
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        // Parse JSON
        let plan: ExecutionPlan;
        try {
            plan = JSON.parse(cleaned) as ExecutionPlan;
        } catch (parseError: any) {
            logError('LLMPlanner', `JSON parse error: ${parseError.message}`);
            logError('LLMPlanner', `Attempted to parse: ${cleaned.slice(0, 500)}`);
            throw new Error(`Invalid JSON from LLM: ${parseError.message}`);
        }

        // Validation
        if (!plan.plan || !Array.isArray(plan.plan)) {
            throw new Error('Invalid plan structure: missing or non-array "plan" field');
        }

        if (plan.plan.length === 0) {
            throw new Error('Invalid plan: empty plan array');
        }

        // Validate each step has required fields
        for (let i = 0; i < plan.plan.length; i++) {
            const step = plan.plan[i];
            if (!step.action) {
                throw new Error(`Invalid step ${i}: missing action`);
            }
            if (!step.description) {
                logWarn('LLMPlanner', `Step ${i} missing description, adding default`);
                step.description = `Lépés ${i + 1}: ${step.action}`;
            }
        }

        // Set defaults
        if (typeof plan.estimatedDuration !== 'number') {
            plan.estimatedDuration = plan.plan.length * 3000; // 3s/step default
            logWarn('LLMPlanner', `Missing estimatedDuration, defaulting to ${plan.estimatedDuration}ms`);
        }

        if (typeof plan.backgroundEligible !== 'boolean') {
            plan.backgroundEligible = plan.estimatedDuration > 30000;
        }

        logInfo('LLMPlanner', `✅ Plan generated: ${plan.plan.length} steps, ${plan.estimatedDuration}ms`);

        return plan;

    } catch (error: any) {
        logError('LLMPlanner', `Failed to generate plan: ${error.message}`);
        throw error;
    }
}

/**
 * Validate Execution Plan structure
 * (Additional runtime validation beyond LLM generation)
 *
 * @param plan - ExecutionPlan to validate
 * @returns boolean - true if valid
 * @throws Error with detailed message if invalid
 */
export function validateExecutionPlan(plan: ExecutionPlan): boolean {
    if (!plan.plan || !Array.isArray(plan.plan)) {
        throw new Error('Invalid plan: missing or non-array "plan" field');
    }

    const validActions = ['navigate', 'click', 'type', 'scroll', 'wait', 'screenshot', 'extract'];

    for (let i = 0; i < plan.plan.length; i++) {
        const step = plan.plan[i];

        // Validate action
        if (!validActions.includes(step.action)) {
            throw new Error(`Invalid step ${i}: unknown action "${step.action}"`);
        }

        // Validate required fields per action type
        switch (step.action) {
            case 'navigate':
                if (!step.url) {
                    throw new Error(`Invalid step ${i}: navigate requires "url"`);
                }
                break;
            case 'click':
            case 'wait':
                if (!step.selector) {
                    throw new Error(`Invalid step ${i}: ${step.action} requires "selector"`);
                }
                break;
            case 'type':
                if (!step.selector || step.text === undefined) {
                    throw new Error(`Invalid step ${i}: type requires "selector" and "text"`);
                }
                break;
            case 'extract':
                if (!step.selector) {
                    throw new Error(`Invalid step ${i}: extract requires "selector"`);
                }
                break;
            // scroll and screenshot have no required fields
        }
    }

    return true;
}
