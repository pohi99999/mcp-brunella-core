/**
 * API Service for Dashboard - Backend Communication
 * Centralized API calls to the MCP Brunella Core backend
 */

const API_BASE = '';  // Same origin

export interface HealthStatus {
    status: string;
    timestamp: string;
    services: {
        ollama: string;
        anythingllm: string;
        agents: string;
        mcp: string;
    };
}

export interface Agent {
    name: string;
    role: string;
    description: string;
}

export interface Task {
    id: number;
    description: string;
    agent_name: string;
    status: string;
    context?: string;
    result?: string;
    created_at: string;
    updated_at: string;
}

export interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
}

export interface Workspace {
    id: string;
    name: string;
    slug: string;
}

/**
 * Health Check
 */
export async function checkHealth(): Promise<HealthStatus> {
    const response = await fetch(`${API_BASE}/api/health`);
    if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Agents API
 */
export async function getAgents(): Promise<Agent[]> {
    const response = await fetch(`${API_BASE}/api/agents`);
    if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    const data = await response.json();
    return data.agents || [];
}

export async function executeAgent(agentName: string, task: string, context?: any): Promise<string> {
    const response = await fetch(`${API_BASE}/api/agents/${agentName}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Agent execution failed');
    }
    
    const data = await response.json();
    return data.result;
}

/**
 * Tasks API
 */
export async function getTasks(): Promise<Task[]> {
    const response = await fetch(`${API_BASE}/api/tasks`);
    if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }
    const data = await response.json();
    return data.tasks || [];
}

export async function createTask(description: string, agentName: string, context?: any, parentId?: number): Promise<number> {
    const response = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, agentName, context, parentId })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Task creation failed');
    }
    
    const data = await response.json();
    return data.taskId;
}

/**
 * Ollama API
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
    try {
        const response = await fetch(`${API_BASE}/api/ollama/models`);
        if (!response.ok) {
            console.warn('Ollama models fetch failed, returning empty array');
            return [];
        }
        const data = await response.json();
        return data.models || [];
    } catch (e) {
        console.warn('Ollama is not available:', e);
        return [];
    }
}

export async function generateWithOllama(prompt: string, model?: string, system?: string): Promise<string> {
    const response = await fetch(`${API_BASE}/api/ollama/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, system })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ollama generation failed');
    }
    
    const data = await response.json();
    return data.response;
}

/**
 * AnythingLLM API
 */
export async function getAnythingLLMWorkspaces(): Promise<Workspace[]> {
    try {
        const response = await fetch(`${API_BASE}/api/anythingllm/workspaces`);
        if (!response.ok) {
            console.warn('AnythingLLM workspaces fetch failed, returning empty array');
            return [];
        }
        const data = await response.json();
        return data.workspaces || [];
    } catch (e) {
        console.warn('AnythingLLM is not available:', e);
        return [];
    }
}

export async function chatWithAnythingLLM(workspace: string, message: string, mode?: string): Promise<string> {
    const response = await fetch(`${API_BASE}/api/anythingllm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace, message, mode })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AnythingLLM chat failed');
    }
    
    const data = await response.json();
    return data.response;
}

/**
 * Chat Messages API
 */
export async function getChatMessages(chatId?: string): Promise<any[]> {
    const url = chatId 
        ? `${API_BASE}/api/chat/messages?chatId=${chatId}` 
        : `${API_BASE}/api/chat/messages`;
        
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch chat messages: ${response.statusText}`);
    }
    const data = await response.json();
    return data.messages || [];
}

/**
 * Tools API
 */
export async function getTools(): Promise<any[]> {
    const response = await fetch(`${API_BASE}/api/tools`);
    if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
    }
    const data = await response.json();
    return data.tools || [];
}

export async function executeTool(toolName: string, args: any): Promise<any> {
    const response = await fetch(`${API_BASE}/api/tools/${toolName}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Tool execution failed');
    }
    
    const data = await response.json();
    return data.result;
}
