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
