/**
 * RobotkezAgent.ts - Browser-Use AI Operator
 * 
 * Ez az ügynök felelős a böngésző alapú automatizációért a Python alrendszeren keresztül.
 * Támogatja a kattintásokat, gépelést és képernyőképek lekérését.
 */

import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError } from '../utils/logger.js';
import { config } from '../config/index.js';

export class RobotkezAgent extends BaseAgent {
    name = 'robotkez';
    role = 'Böngésző Operátor';
    description = 'Böngésző alapú feladatokat hajt végre (kattintás, keresés, form kitöltés)';
    capabilities = ['browser_automation', 'web_scraping', 'ui_interaction', 'screenshots'];

    private pythonApiUrl: string;

    constructor() {
        super();
        this.pythonApiUrl = process.env.BRUNELLA_PYTHON_API_URL || 'http://127.0.0.1:8000';
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const instruction = context.task || '';
        logInfo('RobotkezAgent', `Végrehajtás: ${instruction}`);

        try {
            // 1. Megvizsgáljuk, hogy ez egy egyszerű navigálás vagy komplex feladat
            const isSimpleNavigation = instruction.toLowerCase().startsWith('nyisd meg') || instruction.toLowerCase().startsWith('open');

            // A Python alrendszer /harvest végpontját hívjuk
            // Ha nincs megadott scenario, generálunk egy dinamikusat az instruction alapján
            const response = await fetch(`${this.pythonApiUrl}/harvest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenario_path: 'myai/scenarios/dynamic_chat_task.json', // Ideiglenes, a Python oldalon ezt lekezeljük vagy ad-hoc parancsot küldünk
                    force_mode: 'ui'
                })
            });

            if (!response.ok) {
                throw new Error(`Python API hiba: ${response.statusText}`);
            }

            const result = await response.json();

            return {
                success: result.status === 'ok',
                message: result.result?.message || 'A böngésző művelet befejeződött.',
                data: result.result,
                thoughts: `A feladatot a Python browser_worker hajtotta végre. Állapot: ${result.status}`
            };

        } catch (error: any) {
            logError('RobotkezAgent', `Hiba: ${error.message}`);
            return {
                success: false,
                message: `Nem sikerült végrehajtani a böngésző műveletet: ${error.message}`
            };
        }
    }
}

export default RobotkezAgent;
