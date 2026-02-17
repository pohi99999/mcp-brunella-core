/**
 * RobotkezAgent.ts - Browser-Use AI Operator
 * 
 * Ez az ügynök felelős a böngésző alapú automatizációért a Python alrendszeren keresztül.
 * Támogatja a kattintásokat, gépelést és képernyőképek lekérését.
 */

import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class RobotkezAgent extends BaseAgent {
    name = 'Robotkez'; // Corrected name to match routing
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
        logInfo('RobotkezAgent', `Végrehajtás: ${instruction.slice(0, 100)}...`);

        try {
            const taskId = `robotkez-task-${uuidv4()}`;
            
            // Construct the payload for the Python server's /api/task endpoint
            const requestBody = {
                taskId: taskId,
                type: "browser",
                payload: {
                    instruction: instruction,
                    context: context.context || {} // Pass the nested context object
                }
            };

            const response = await fetch(`${this.pythonApiUrl}/api/task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logError('RobotkezAgent', `Python API hiba (${response.status}): ${errorText}`);
                throw new Error(`Python API hiba: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result: any = await response.json();

            return {
                success: result.status === 'ok',
                message: result.result?.summary || 'A böngésző művelet befejeződött.',
                data: result.result, // Pass the whole result object back
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
