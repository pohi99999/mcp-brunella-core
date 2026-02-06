// Basic Agent Interface (Legacy)
export interface IAgent {
    name: string;
    role: string;
    description: string;
    capabilities: string[];
    execute(task: string, context?: any): Promise<any>;
}

// Swarm Context - Shared Memory
export interface ISwarmContext {
    sessionId: string;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string; agent?: string }>;
    artifacts: Record<string, any>; // Shared data (e.g. dataframes, search results)
    activeAgent?: string;
}

// Handoff Protocol
export interface AgentHandoff {
    type: 'handoff';
    targetAgent: string;
    reason: string;
    instruction: string; // The new prompt for the target agent
    contextUpdates?: Record<string, any>;
}

// Standard Agent Response
export interface AgentResponse {
    status: 'success' | 'error' | 'delegated' | 'handoff';
    data?: any;
    error?: string;
    message?: string; // Optional message describing the result
    nextStep?: string;
    delegatedTo?: string; // Target agent name when status is 'delegated'
    handoff?: AgentHandoff; // If status is 'handoff'
}