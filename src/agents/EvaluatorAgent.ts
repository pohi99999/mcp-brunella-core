import { IAgent } from './types.js';
import { Logger } from '../utils/logger.js';
import { checkOllamaHealth, checkAnythingLLMHealth } from '../utils/health.js';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class EvaluatorAgent implements IAgent {
    name = "Evaluator";
    role = "QA_Lead";
    description = "Performs system audits, runs tests, and validates health.";
    capabilities = ["audit_system", "run_tests", "check_health"];
    
    private logger: Logger;

    constructor() {
        this.logger = new Logger('evaluator.log');
    }

    async execute(task: string, context?: any): Promise<any> {
        this.logger.info(`Processing task: ${task}`);

        if (task.includes("health") || task.includes("audit")) {
            return this.performAudit();
        }

        if (task.includes("test")) {
            return this.runTests();
        }

        return { status: "error", error: "Unknown task for Evaluator." };
    }

    private async performAudit() {
        const ollama = await checkOllamaHealth();
        const anything = await checkAnythingLLMHealth();
        
        const status = (ollama.status === 'healthy' && anything.status === 'healthy') ? "HEALTHY" : "DEGRADED";
        
        return {
            status,
            components: {
                ollama,
                anythingllm: anything
            },
            recommendation: status === "HEALTHY" ? "System is nominal." : "Check failing components."
        };
    }

    private async runTests() {
        try {
            // Running tests via npm. Warning: this might be slow and capture a lot of output.
            // We use 'npm test' which now runs 'vitest run'
            const { stdout, stderr } = await execAsync('npm test', { timeout: 30000 });
            return {
                status: "success",
                output: stdout.slice(0, 2000), // Limit output size
                errors: stderr ? stderr.slice(0, 500) : null
            };
        } catch (e: any) {
            return {
                status: "failure",
                error: e.message,
                output: e.stdout ? e.stdout.slice(0, 2000) : null,
                details: e.stderr ? e.stderr.slice(0, 500) : null
            };
        }
    }
}
