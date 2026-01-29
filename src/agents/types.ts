export interface IAgent {
    name: string;
    role: string;
    description: string;
    capabilities: string[];
    execute(task: string, context?: any): Promise<any>;
}

export interface AgentResponse {
    status: 'success' | 'error' | 'delegated';
    data?: any;
    error?: string;
    nextStep?: string;
}