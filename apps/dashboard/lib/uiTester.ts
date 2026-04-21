/**
 * UI Tester - Kliens oldali komponens és funkcionális tesztelő egység.
 * Képes ellenőrizni a Dashboard elemeinek integritását és a kritikus adatfolyamokat.
 */

import * as apiService from './apiService';

export interface UITestResult {
    name: string;
    status: 'pass' | 'fail' | 'running';
    durationMs: number;
    error?: string;
}

export class UITester {
    async runAllTests(): Promise<UITestResult[]> {
        const results: UITestResult[] = [];
        
        results.push(await this.testBackendConnectivity());
        results.push(await this.testSocketIntegritiy());
        results.push(await this.testAgentRegistryLoad());
        results.push(await this.testTaskQueueAccess());
        
        return results;
    }

    private async testBackendConnectivity(): Promise<UITestResult> {
        const start = Date.now();
        try {
            await apiService.checkHealth();
            return { name: 'Backend Connectivity', status: 'pass', durationMs: Date.now() - start };
        } catch (e: any) {
            return { name: 'Backend Connectivity', status: 'fail', durationMs: Date.now() - start, error: e.message };
        }
    }

    private async testSocketIntegritiy(): Promise<UITestResult> {
        const start = Date.now();
        const isConnected = (window as any).__BRUNELLA_SOCKET__?.connected || false;
        return { 
            name: 'Socket.IO Integrity', 
            status: isConnected ? 'pass' : 'fail', 
            durationMs: Date.now() - start,
            error: isConnected ? undefined : 'Socket not connected'
        };
    }

    private async testAgentRegistryLoad(): Promise<UITestResult> {
        const start = Date.now();
        try {
            const registry = await apiService.getRegistry();
            const hasAgents = registry.agents && registry.agents.length > 0;
            return { 
                name: 'Agent Registry Load', 
                status: hasAgents ? 'pass' : 'fail', 
                durationMs: Date.now() - start,
                error: hasAgents ? undefined : 'No agents found in registry'
            };
        } catch (e: any) {
            return { name: 'Agent Registry Load', status: 'fail', durationMs: Date.now() - start, error: e.message };
        }
    }

    private async testTaskQueueAccess(): Promise<UITestResult> {
        const start = Date.now();
        try {
            await apiService.getTasks(1, 0);
            return { name: 'Task Queue access', status: 'pass', durationMs: Date.now() - start };
        } catch (e: any) {
            return { name: 'Task Queue access', status: 'fail', durationMs: Date.now() - start, error: e.message };
        }
    }
}

export const uiTester = new UITester();
