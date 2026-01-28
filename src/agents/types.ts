import { z } from "zod";

export interface IAgent {
    name: string;
    description: string;
    capabilities: string[];
    execute: (task: string, context?: any) => Promise<string>;
}

export interface AgentRegistry {
    [key: string]: IAgent;
}

export interface PlanStep {
    id: string;
    description: string;
    agent: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: string;
    dependencies?: string[];
}

export interface ExecutionPlan {
    id: string; // Ha ez hiányzott
    task?: string; // Ha a kódban "task"-ot használnak
    goal?: string; // Ha "goal"-t
    steps: PlanStep[];
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}