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

import { generateRouted, generateResponse } from '../core/llm_client.js';
import { logInfo, logWarn, logError } from './logger.js';

// Ha beállítva, felülírja a ModelRouter döntését (pl. 'cloudflare', 'gemini', 'ollama')
const PLANNER_LLM_OVERRIDE = process.env.ROBOTKEZ_LLM_PROVIDER || process.env.LLM_PLANNER_PROVIDER;
// Cloudflare Workers AI brain modell a tervező számára
const CF_PLANNER_MODEL = process.env.CF_AI_SMART_MODEL || '@cf/meta/llama-3.3-70b-instruct';

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
    action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract' | 'press' | 'vision-click';
    selector?: string;
    url?: string;
    text?: string;
    key?: string; // NEW: for press action
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
- vision-click(target): Kattintás vizuális leírás alapján (pl. "n8n Add Node button", "Mentés gomb"). Ezt használd ha a selector nem egyértelmű vagy dinamikus felületről (n8n, Langflow) van szó.
- type(selector, text): Szöveg gépelés input mezőbe
- press(key): Billentyű megnyomása (pl. "Enter", "Tab", "Escape")
- scroll(direction, amount): Görgetés (direction: up/down/left/right, amount: pixels)
- wait(selector, timeout): Várakozás elem megjelenésére (timeout ms-ben)
- screenshot(): Képernyőkép készítés
- extract(selector, type): Adat kinyerés (type: text/attribute/html)

SZABÁLYOK:
1. Minden lépésnek legyen magyar description (pl. "Google megnyitása")
2. Használj wait()-et oldal betöltés után (selector: tipikusan első interaktív elem)
3. CSS selectorok legyenek ÁLTALÁNOSAK, NE használj specifikus ID-kat!
4. Ha bonyolult, canvas-alapú UI-t kezelsz (n8n, Langflow), preferáld a vision-click()-et.
5. Wait timeout legyen HOSSZÚ (min 8000-10000ms), mert oldalak lassan tölthetnek!
6. Estimated duration legyen reális (ms-ben, átlagosan 3-8s/lépés)
7. backgroundEligible: true ha > 30s várható időtartam
8. Minden navigate után használj wait()-et hogy biztos legyen hogy betöltött az oldal
9. Ha a felhasználó csak azt kéri, hogy "nyisd meg a böngészőt" vagy "indítsd el a böngészőt", de nem ad meg URL-t, AKKOR generálj egy navigate lépést az "about:blank" vagy "https://www.google.com" URL-re. SOHA ne hagyj URL nélkül egy navigate lépést.

VÁLASZ FORMÁTUM (CSAK JSON, semmi más):
{
  "plan": [
    { "action": "navigate", "url": "https://example.com", "description": "Példa oldal megnyitása" },
    { "action": "wait", "selector": "input[type='text']", "timeout": 10000, "description": "Input mező betöltésre vár" },
    { "action": "vision-click", "target": "Kék belépés gomb", "description": "Vizuális kattintás a belépéshez" }
  ],
  "estimatedDuration": 15000,
  "requiresUserInput": [],
  "backgroundEligible": false,
  "contextNeeded": []
}

FONTOS: Csak valid JSON-t adj vissza, semmi más szöveget!`;

/**
 * Generate Execution Plan from magyar instruction
 *
 * @param instruction - Magyar nyelvű utasítás (pl. "Keress rá az AI hírekre")
 * @param options - Contextual options (history, browser state)
 * @returns ExecutionPlan - Multi-step browser automation plan
 * @throws Error if LLM response is invalid or cannot be parsed
 */
export async function generateExecutionPlan(
    instruction: string, 
    options?: { 
        history?: Array<{ role: string, content: string }>,
        browserState?: { url: string, title?: string }
    }
): Promise<ExecutionPlan> {
    logInfo('LLMPlanner', `Generating plan for: "${instruction}"`);

    let contextPrompt = '';
    if (options?.browserState) {
        contextPrompt += `\nJELENLEGI BÖNGÉSZŐ ÁLLAPOT:\n- URL: ${options.browserState.url}\n- Cím: ${options.browserState.title || 'N/A'}\n`;
    }

    if (options?.history && options.history.length > 0) {
        contextPrompt += `\nKORÁBBI BESZÉLGETÉS:\n${options.history.map(h => `${h.role}: ${h.content}`).join('\n')}\n`;
    }

    const userPrompt = `${contextPrompt}\nÚJ UTASÍTÁS: ${instruction}

Készíts részletes execution plan-t a fenti utasítás végrehajtásához, figyelembe véve a kontextust.`;

    try {
        // Call LLM (using Model Router to pick brain model, or env var override)
        const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
        let response: string;

        if (PLANNER_LLM_OVERRIDE === 'cloudflare') {
            logInfo('LLMPlanner', `CF AI override aktív (ROBOTKEZ_LLM_PROVIDER=cloudflare), modell: ${CF_PLANNER_MODEL}`);
            response = await generateResponse(fullPrompt, 'cloudflare', CF_PLANNER_MODEL);
        } else if (PLANNER_LLM_OVERRIDE) {
            logInfo('LLMPlanner', `LLM override aktív: ${PLANNER_LLM_OVERRIDE}`);
            response = await generateResponse(fullPrompt, PLANNER_LLM_OVERRIDE);
        } else {
            const routed = await generateRouted(fullPrompt, instruction, { category: 'planning' });
            response = routed.response;
        }

        logInfo('LLMPlanner', `Raw LLM response: ${response.slice(0, 200)}...`);

        // Clean up response: extract JSON between first { and last }
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
            throw new Error('No valid JSON object found in LLM response');
        }

        const cleaned = response.slice(firstBrace, lastBrace + 1);

        // Parse JSON
        let plan: ExecutionPlan;
        try {
            plan = JSON.parse(cleaned) as ExecutionPlan;
        } catch (parseError: unknown) {
            const msg = parseError instanceof Error ? parseError.message : String(parseError);
            logError('LLMPlanner', `JSON parse error: ${msg}`);
            logError('LLMPlanner', `Attempted to parse: ${cleaned.slice(0, 500)}`);
            throw new Error(`Invalid JSON from LLM: ${msg}`);
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

        // POST-PROCESSING: Override short wait timeouts (LLM often generates too short timeouts)
        for (const step of plan.plan) {
            if (step.action === 'wait') {
                if (!step.timeout || step.timeout < 10000) {
                    const oldTimeout = step.timeout || 0;
                    step.timeout = 10000; // Force 10s minimum for wait actions
                    logWarn('LLMPlanner', `⚠️ Overriding wait timeout ${oldTimeout}ms → 10000ms for selector: ${step.selector}`);
                }
            }
        }

        logInfo('LLMPlanner', `✅ Plan generated: ${plan.plan.length} steps, ${plan.estimatedDuration}ms`);

        return plan;

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('LLMPlanner', `Failed to generate plan: ${msg}`);
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
