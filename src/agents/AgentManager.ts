import { IAgent, AgentResponse } from './types.js';
import { Logger } from '../utils/logger.js';

class AgentManager {
    private agents: Map<string, IAgent> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = new Logger('agent-manager.log');
    }

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

    // For compatibility with Registry tool
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
        if (!agent) {
            throw new Error(`Agent '${agentName}' not found.`);
        }

        this.logger.info(`Delegating task to ${agentName}: ${task}`);
        try {
            const result = await agent.execute(task, context);
            return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        } catch (error: any) {
            this.logger.error(`Agent ${agentName} failed: ${error.message}`);
            throw error;
        }
    }

    // Dummy methods for now to satisfy CLI calls if any
    async createPlan(goal: string) { return { goal, steps: [] }; }
    async executePlan(plan: any, cb: any) { return "Plan execution stub."; }
}

export const agentManager = new AgentManager();