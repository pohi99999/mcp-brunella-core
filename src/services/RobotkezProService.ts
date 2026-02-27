import { logInfo, logError } from '../utils/logger.js';
import fetch from 'node-fetch';

export interface UIAction {
    action: 'click' | 'type' | 'navigate' | 'wait' | 'vision-click' | 'press';
    target?: string; // CSS selector or description for vision
    text?: string;
    url?: string;
    x?: number;
    y?: number;
    description: string; // Magyar description for logging/overlay
}

/**
 * RobotkezProService - Bridge to the Python Action Server (BVAB)
 */
export class RobotkezProService {
    private static instance: RobotkezProService;
    private baseUrl: string = process.env.PYTHON_API_URL || 'http://localhost:8000';

    public static getInstance(): RobotkezProService {
        if (!RobotkezProService.instance) {
            RobotkezProService.instance = new RobotkezProService();
        }
        return RobotkezProService.instance;
    }

    private async call(path: string, body?: any) {
        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                method: body ? 'POST' : 'GET',
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });
            return await response.json();
        } catch (error) {
            logError("RobotkezPro", `Call to ${path} failed: ${error}`);
            return { status: 'error', message: String(error) };
        }
    }

    /**
     * Executes a single UI action.
     */
    async executeAction(action: UIAction) {
        logInfo("RobotkezPro", `Executing: ${action.description}`);
        
        switch (action.action) {
            case 'navigate':
                return await this.call('/api/robotkez/action', { action: 'navigate', params: { url: action.url } });
            case 'click':
                if (action.x !== undefined && action.y !== undefined) {
                    return await this.call('/os/click', { x: action.x, y: action.y });
                }
                return await this.call('/api/robotkez/action', { action: 'click', params: { selector: action.target } });
            case 'type':
                return await this.call('/os/type', { text: action.text });
            case 'vision-click':
                return await this.call('/os/vision-click', { description: action.target });
            case 'press':
                return await this.call('/api/robotkez/action', { action: 'press', params: { key: action.text } });
            default:
                return { status: 'error', message: `Unknown action: ${action.action}` };
        }
    }

    /**
     * Executes a series of actions (a plan).
     */
    async executePlan(actions: UIAction[], onProgress?: (msg: string) => void) {
        const results = [];
        for (const action of actions) {
            if (onProgress) onProgress(action.description);
            const res = await this.executeAction(action) as Record<string, unknown>;
            results.push(res);
            if (res['status'] === 'error') break; // Halt on failure
            await new Promise(r => setTimeout(r, 1000)); // Adaptive delay
        }
        return results;
    }

    async getSnapshot() {
        return await this.call('/api/robotkez/snapshot');
    }
}

export const robotkezPro = RobotkezProService.getInstance();
