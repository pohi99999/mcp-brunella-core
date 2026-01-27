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
    agent: string; // "ops", "developer", etc.
    tool?: string; // Optional: suggested tool
    args?: any;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: string;
}

export interface ExecutionPlan {
    task: string;
    steps: PlanStep[];
}