// FILE: src/utils/developerMetrics.ts
// PURPOSE: Persistent metrics collection for Developer Agent (P10)
// VERSION: 1.0

import path from 'path';
import fs from 'fs/promises';
import { logError, logInfo } from './logger.js';
import { config } from '../config/index.js';

interface MetricsData {
    builds: {
        total: number;
        success: number;
        fail: number;
        lastStatus: 'success' | 'fail' | 'unknown';
        lastDurationMs: number;
        lastTimestamp?: number;
    };
    tests: {
        totalRuns: number;
        lastPassRate: number; // 0-100
        lastDurationMs: number;
        lastTimestamp?: number;
    };
    tasks: {
        total: number;
        success: number;
        error: number;
        avgDurationMs: number;
    };
    ai: {
        totalTokenUsage: number; // Placeholder for now
        estimatedCost: number;  // Placeholder
    };
    history: Array<{
        type: 'task' | 'build' | 'test';
        status: 'success' | 'fail' | 'error';
        details: string; // Task ID or Build/Test Label
        durationMs: number;
        timestamp: number;
    }>;
}

const DEFAULT_METRICS: MetricsData = {
    builds: { total: 0, success: 0, fail: 0, lastStatus: 'unknown', lastDurationMs: 0 },
    tests: { totalRuns: 0, lastPassRate: 0, lastDurationMs: 0 },
    tasks: { total: 0, success: 0, error: 0, avgDurationMs: 0 },
    ai: { totalTokenUsage: 0, estimatedCost: 0 },
    history: []
};

class DeveloperMetrics {
    private dataFile: string;
    private data: MetricsData;
    private loaded = false;

    constructor() {
        this.dataFile = path.join(process.cwd(), 'data', 'developer_metrics.json');
        this.data = JSON.parse(JSON.stringify(DEFAULT_METRICS));
    }

    private async ensureLoaded() {
        if (this.loaded) return;
        
        try {
            await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
            try {
                const content = await fs.readFile(this.dataFile, 'utf-8');
                this.data = JSON.parse(content);
                // Merge with default to ensure new fields exists
                this.data = { ...DEFAULT_METRICS, ...this.data };
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    logError('DeveloperMetrics', `Failed to load metrics: ${error.message}`);
                }
                // Use default if file doesn't exist
            }
        } catch (error: any) {
            logError('DeveloperMetrics', `Failed to init metrics dir: ${error.message}`);
        }
        this.loaded = true;
    }

    private async save() {
        try {
            // Keep history limited to 100 items
            if (this.data.history.length > 100) {
                this.data.history = this.data.history.slice(0, 100);
            }
            await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (error: any) {
            logError('DeveloperMetrics', `Failed to save metrics: ${error.message}`);
        }
    }

    async recordTask(taskId: string, success: boolean, durationMs: number) {
        await this.ensureLoaded();
        this.data.tasks.total++;
        if (success) {
            this.data.tasks.success++;
        } else {
            this.data.tasks.error++;
        }

        // Rolling average for duration
        const oldAvg = this.data.tasks.avgDurationMs;
        const count = this.data.tasks.total;
        this.data.tasks.avgDurationMs = Math.round(((oldAvg * (count - 1)) + durationMs) / count);

        this.data.history.unshift({
            type: 'task',
            status: success ? 'success' : 'error',
            details: taskId,
            durationMs,
            timestamp: Date.now()
        });

        await this.save();
    }

    async recordBuild(success: boolean, durationMs: number) {
        await this.ensureLoaded();
        this.data.builds.total++;
        if (success) {
            this.data.builds.success++;
            this.data.builds.lastStatus = 'success';
        } else {
            this.data.builds.fail++;
            this.data.builds.lastStatus = 'fail';
        }
        this.data.builds.lastDurationMs = durationMs;
        this.data.builds.lastTimestamp = Date.now();

        this.data.history.unshift({
            type: 'build',
            status: success ? 'success' : 'fail',
            details: 'build',
            durationMs,
            timestamp: Date.now()
        });

        await this.save();
    }

    async recordTest(passRate: number, durationMs: number) {
        await this.ensureLoaded();
        this.data.tests.totalRuns++;
        this.data.tests.lastPassRate = passRate;
        this.data.tests.lastDurationMs = durationMs;
        this.data.tests.lastTimestamp = Date.now();

        this.data.history.unshift({
            type: 'test',
            status: passRate === 100 ? 'success' : 'fail',
            details: `Rate: ${passRate}%`,
            durationMs,
            timestamp: Date.now()
        });

        await this.save();
    }

    async getMetrics(): Promise<MetricsData> {
        await this.ensureLoaded();
        return this.data;
    }
}

export const developerMetrics = new DeveloperMetrics();
