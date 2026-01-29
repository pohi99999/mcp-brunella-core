import { IAgent, AgentResponse } from './types.js';
import { Logger } from '../utils/logger.js';
import db from '../utils/db.js';

class AgentManager {
    private agents: Map<string, IAgent> = new Map();
    private logger: Logger;
    private isProcessing = false;

    constructor() {
        this.logger = new Logger('agent-manager.log');
    }

    // --- Task Queue Methods ---
    
    queueTask(description: string, agentName: string, context?: any, parentId?: number): number {
        const stmt = db.prepare('INSERT INTO tasks (description, agent_name, context, parent_id) VALUES (?, ?, ?, ?)');
        const result = stmt.run(description, agentName.toLowerCase(), JSON.stringify(context || {}), parentId || null);
        this.logger.info(`Task queued [${result.lastInsertRowid}]: ${description} for ${agentName}`);
        return result.lastInsertRowid as number;
    }

    updateTaskStatus(id: number, status: string, result?: any) {
        const stmt = db.prepare('UPDATE tasks SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(status, result ? JSON.stringify(result) : null, id);
        this.logger.info(`Task [${id}] updated to ${status}`);
    }

    getPendingTasks() {
        const stmt = db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC");
        return stmt.all();
    }

    getAllTasks() {
        const stmt = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 50');
        return stmt.all();
    }

    // --- Worker Loop ---

    async startWorkerLoop() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.logger.info("Agent Worker Loop started.");
        
        while (this.isProcessing) {
            const pending = this.getPendingTasks() as any[];
            for (const task of pending) {
                const agent = this.getAgent(task.agent_name);
                if (agent) {
                    try {
                        this.updateTaskStatus(task.id, 'running');
                        const context = JSON.parse(task.context || '{}');
                        const result = await agent.execute(task.description, context);
                        this.updateTaskStatus(task.id, 'completed', result);
                    } catch (e: any) {
                        this.updateTaskStatus(task.id, 'failed', { error: e.message });
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    stopWorkerLoop() {
        this.isProcessing = false;
    }

    // --- Agent Management ---

    registerAgent(agent: IAgent) {
        this.agents.set(agent.name.toLowerCase(), agent);
        this.logger.info(`Agent registered: ${agent.name}`);
    }

    getAgent(name: string): IAgent | undefined {
        return this.agents.get(name.toLowerCase());
    }

    listAgents(): IAgent[] {
        return Array.from(this.agents.values());
    }

    listAgentDefinitions() {
        return this.listAgents().map(a => ({
            name: a.name,
            role: a.role,
            description: a.description
        }));
    }

    listRegistryDefinitions() {
        return this.listAgentDefinitions();
    }

    async delegate(agentName: string, task: string, context?: any): Promise<string> {
        const agent = this.getAgent(agentName);
        if (!agent) throw new Error(`Agent '${agentName}' not found.`);

        this.logger.info(`Delegating task to ${agentName}: ${task}`);
        try {
            const result = await agent.execute(task, context);
            return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        } catch (error: any) {
            this.logger.error(`Agent ${agentName} failed: ${error.message}`);
            throw error;
        }
    }

    async createPlan(goal: string) { 
        const orchestrator = this.getAgent('Orchestrator');
        if (!orchestrator) {
            return { goal, steps: [], status: "error", error: "Orchestrator not found" };
        }
        this.logger.info(`Creating plan for goal: ${goal}`);
        const result = await orchestrator.execute(goal);
        return {
            goal,
            ...result
        };
    }

    async executePlan(plan: any, cb: (event: string, data: any) => void) { 
        if (!plan.taskIds || plan.taskIds.length === 0) {
            return "No tasks to execute in the plan.";
        }

        const taskIds = plan.taskIds as number[];
        let completedCount = 0;
        const total = taskIds.length;

        cb('plan_started', { total });

        while (completedCount < total) {
            const placeholders = taskIds.map(() => '?').join(',');
            const stmt = db.prepare(`SELECT id, status, result FROM tasks WHERE id IN (${placeholders})`);
            const tasks = stmt.all(...taskIds) as any[];
            
            completedCount = 0;
            for (const task of tasks) {
                if (task.status === 'completed' || task.status === 'failed') {
                    completedCount++;
                }
                cb('task_progress', { id: task.id, status: task.status, result: task.result });
            }

            if (completedCount < total) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        return `Plan executed. ${completedCount}/${total} tasks finished.`;
    }
}

export const agentManager = new AgentManager();
