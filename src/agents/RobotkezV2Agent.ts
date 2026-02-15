/**
 * RobotkezV2Agent - Magyar nyelvű Agentic Browser (Comet-style)
 *
 * Inspiráció: Perplexity Comet (https://www.perplexity.ai/comet)
 *
 * Phase 2: Simple intent parsing (regex-based)
 * Phase 3: LLM-based multi-step planning (Ollama/Gemini)
 *
 * @author Claude Code + Pohánka Péter
 * @track robotkezv2-full-comet-20260215
 */

import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { persistentBrowser } from '../utils/persistentBrowser.js';

/**
 * Intent (Phase 2 MVP - simple regex parsing)
 * Phase 3-ban LLM-re cseréljük
 */
interface Intent {
    type: 'navigate' | 'search' | 'click' | 'type' | 'screenshot';
    url?: string;
    query?: string;
    selector?: string;
    text?: string;
}

export class RobotkezV2Agent extends BaseAgent {
    name = 'RobotkezV2';
    role = 'Magyar Agentic Browser';
    description = 'Perplexity Comet-szerű intelligens böngésző ügynök magyar nyelven';
    capabilities = [
        'agentic_browsing',
        'multi_step_automation',
        'context_awareness',
        'magyar_nyelv',
        'tool_orchestration'
    ];

    /**
     * Fő entry point (IAgent interface)
     *
     * @param context - AgentContext (task + opcionális context)
     * @returns AgentResult - success/message/data
     */
    async executeTask(context: AgentContext): Promise<AgentResult> {
        const instruction = context.task || '';
        setAgentStatus(this.name, 'working', instruction.slice(0, 50));

        try {
            logInfo(this.name, `Utasítás: ${instruction}`);

            // 1. Intent parsing (egyszerű verzió Phase 2-ben, LLM Phase 3-ban)
            const intent = this.parseHungarianIntent(instruction);
            logInfo(this.name, `Intent típus: ${intent.type}`);

            // 2. Simple plan execution (direct browser tool calls)
            const result = await this.executeSimplePlan(intent);

            // 3. Screenshot (Live View frissítés)
            await persistentBrowser.sendCommand({ action: 'screenshot' }).catch(() => {});

            logInfo(this.name, `✅ Sikeres végrehajtás: ${result.message}`);

            return {
                success: true,
                message: result.message,
                data: result.data,
                thoughts: `Intent: ${intent.type}`,
                contextUsed: ['persistent_browser']
            };

        } catch (error: any) {
            logError(this.name, `Hiba: ${error.message}`);
            return {
                success: false,
                message: `Nem sikerült: ${error.message}`,
                data: { error: error.message }
            };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    /**
     * Simple intent parsing (regex-based, Phase 2 MVP)
     * Phase 3-ban LLM-re cseréljük
     *
     * Magyar természetes nyelv → Intent
     *
     * Támogatott parancsok:
     * - "Navigálj a google.com-ra" → navigate
     * - "Keress rá a 'TypeScript' témára" → search
     * - "Kattints a '.login-button'-ra" → click
     * - "Írj be 'Hello World'" → type
     * - "Készíts képernyőképet" → screenshot
     *
     * @param instruction - Magyar nyelvű utasítás
     * @returns Intent object
     */
    private parseHungarianIntent(instruction: string): Intent {
        const lower = instruction.toLowerCase();

        // Navigáció pattern
        if (lower.match(/navigálj|menj|nyisd meg|látogasd meg/)) {
            const urlMatch = instruction.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                return { type: 'navigate', url: urlMatch[1] };
            }

            // Google search fallback
            const searchQuery = instruction.replace(/navigálj|menj|nyisd meg|látogasd meg|keress rá/gi, '').trim();
            return {
                type: 'search',
                query: searchQuery,
                url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
            };
        }

        // Kattintás pattern
        if (lower.match(/kattints|klikk|nyomd meg/)) {
            const selectorMatch = instruction.match(/['"](.*?)['"]/);
            const selector = selectorMatch ? selectorMatch[1] : '.primary-button';
            return { type: 'click', selector };
        }

        // Gépelés pattern
        if (lower.match(/írj|gépelj|tölts ki/)) {
            const textMatch = instruction.match(/['"](.*?)['"]/);
            const text = textMatch ? textMatch[1] : '';
            const selectorMatch = instruction.match(/(?:a |az |be a )['"]?([\w\-\.#\[\]= ]+)['"]?(?:-ba|-be|-ra|-re)?/);
            const selector = selectorMatch ? selectorMatch[1] : 'input';
            return { type: 'type', text, selector };
        }

        // Screenshot
        if (lower.match(/készíts képet|screenshot|kép/)) {
            return { type: 'screenshot' };
        }

        // Default: Google search
        logInfo(this.name, `Nincs konkrét parancs, Google keresés: "${instruction}"`);
        return {
            type: 'search',
            query: instruction,
            url: `https://www.google.com/search?q=${encodeURIComponent(instruction)}`
        };
    }

    /**
     * Execute simple intent (Phase 2 MVP)
     * Phase 3-ban multi-step LLM plan execution
     *
     * @param intent - Parsed intent
     * @returns Execution result (message + data)
     */
    private async executeSimplePlan(intent: Intent): Promise<{ message: string; data: any }> {
        switch (intent.type) {
            case 'navigate':
            case 'search':
                const navRes = await persistentBrowser.sendCommand({
                    action: 'navigate',
                    url: intent.url!
                });
                return {
                    message: `Navigáltam ide: ${navRes.url || intent.url}`,
                    data: { url: navRes.url || intent.url, query: intent.query }
                };

            case 'click':
                await persistentBrowser.sendCommand({
                    action: 'click',
                    selector: intent.selector!
                });
                return {
                    message: `Kattintottam: ${intent.selector}`,
                    data: { selector: intent.selector }
                };

            case 'type':
                await persistentBrowser.sendCommand({
                    action: 'type',
                    selector: intent.selector!,
                    text: intent.text!
                });
                return {
                    message: `Begépeltem: "${intent.text}" a(z) ${intent.selector} mezőbe`,
                    data: { text: intent.text, selector: intent.selector }
                };

            case 'screenshot':
                await persistentBrowser.sendCommand({ action: 'screenshot' });
                return {
                    message: 'Képernyőkép készítve',
                    data: { screenshot: true }
                };

            default:
                throw new Error(`Ismeretlen intent: ${(intent as any).type}`);
        }
    }
}

export default RobotkezV2Agent;
