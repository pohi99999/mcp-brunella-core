/**
 * API Service for Dashboard - Backend Communication
 * Centralized API calls to the MCP Brunella Core backend
 */

const API_BASE = '';  // Same origin
const DEFAULT_TIMEOUT_MS = 30000;  // 30 seconds default timeout
const LONG_TIMEOUT_MS = 120000;    // 2 minutes for LLM calls

/** Fetch with timeout support */
async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error(`Időtúllépés (${timeoutMs / 1000}s)`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/** Biztonságos JSON parse – üres vagy hibás válasz kezelése */
async function safeJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text || text.trim().length === 0) {
        throw new Error(response.ok ? 'Üres válasz' : `HTTP ${response.status}: ${response.statusText}`);
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`Érvénytelen válasz: ${text.slice(0, 100)}...`);
    }
}

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
    const response = await fetchWithTimeout(`${API_BASE}/api/health`, {}, 10000);  // 10s for health
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    return safeJson<HealthStatus>(response);
}

/**
 * Agents API
 */
export async function getAgents(): Promise<Agent[]> {
    const response = await fetchWithTimeout(`${API_BASE}/api/agents`);
    if (!response.ok) throw new Error(`Agents: HTTP ${response.status}`);
    const data = await safeJson<{ agents?: Agent[] }>(response);
    return data.agents || [];
}

export interface RegistryAgent {
    name: string;
    class: string;
    module: string;
    description: string;
    capabilities: string[];
    priority: number;
    autoStart: boolean;
    systemPrompt?: string;
    triggers?: string[];
    config?: Record<string, unknown>;
}

export interface Registry {
    version: string;
    agents: RegistryAgent[];
    defaultAgent: string;
    routingRules: Array<{ pattern: string; agent: string }>;
}

export async function getRegistry(): Promise<Registry> {
    const response = await fetchWithTimeout(`${API_BASE}/api/registry`);
    if (!response.ok) throw new Error(`Registry: HTTP ${response.status}`);
    return safeJson<Registry>(response);
}

export async function getAgentStatuses(): Promise<Agent[]> {
    const response = await fetchWithTimeout(`${API_BASE}/api/agents/status`);
    if (!response.ok) throw new Error(`Agent Status: HTTP ${response.status}`);
    const data = await safeJson<{ agents?: Agent[] }>(response);
    return data.agents || [];
}

export interface QueuedTask {
    id: number;
    agent_name: string;
    description: string;
    status: string;
    created_at: string;
    updated_at: string;
    context?: string;
    result?: string;
}

export interface TasksResponse {
    tasks: QueuedTask[];
    total: number;
    limit: number;
    offset: number;
}

export async function getTasks(limit: number = 50, offset: number = 0): Promise<TasksResponse> {
    const response = await fetchWithTimeout(`${API_BASE}/api/tasks?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error(`Tasks: HTTP ${response.status}`);
    return safeJson<TasksResponse>(response);
}

export interface ProviderStatus {
    id: string;
    name: string;
    status: 'online' | 'offline';
    latency?: number;
    error?: string;
}

export async function getProvidersStatus(): Promise<ProviderStatus[]> {
    const response = await fetchWithTimeout(`${API_BASE}/api/providers/status`);
    if (!response.ok) throw new Error(`Providers Status: HTTP ${response.status}`);
    const data = await safeJson<{ providers?: ProviderStatus[] }>(response);
    return data.providers || [];
}

export async function executeAgent(agentName: string, task: string, context?: any): Promise<any> {
    const response = await fetchWithTimeout(
        `${API_BASE}/api/agents/${encodeURIComponent(agentName)}/execute`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, context })
        },
        LONG_TIMEOUT_MS  // 2 minutes for agent execution
    );
    const data: any = await safeJson<{ result?: any; error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.error || 'Agent execution failed');
    return data.result;
}

export async function createAgent(config: { name: string, role: string, description: string, capabilities: string[], triggers?: string[] }): Promise<any> {
    const response = await fetchWithTimeout(
        `${API_BASE}/api/agents/create`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        }
    );
    const data: any = await safeJson<{ status?: string; error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.error || 'Agent creation failed');
    return data;
}


/**
 * Ollama API
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
    try {
        const response = await fetch(`${API_BASE}/api/ollama/models`);
        if (!response.ok) return [];
        const data = await safeJson<{ models?: OllamaModel[] }>(response);
        return data.models || [];
    } catch {
        return [];
    }
}

export async function generateWithOllama(prompt: string, model?: string, system?: string): Promise<string> {
    const response = await fetchWithTimeout(
        `${API_BASE}/api/ollama/generate`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, system })
        },
        LONG_TIMEOUT_MS  // 2 minutes for LLM generation
    );
    const data = await safeJson<{ response?: string; error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.error || 'Ollama generation failed');
    return typeof data.response === 'string' ? data.response : String(data.response ?? '');
}

/**
 * GitHub Models API
 */
export interface GithubModel {
    name: string;
    provider: string;
}

export async function getGithubModels(): Promise<GithubModel[]> {
    try {
        const response = await fetch(`${API_BASE}/api/github-models/models`);
        if (!response.ok) return [];
        const data = await safeJson<{ models?: GithubModel[] }>(response);
        return data.models || [];
    } catch {
        return [];
    }
}

export async function generateWithGithubModels(prompt: string, model?: string, system?: string): Promise<string> {
    const response = await fetchWithTimeout(
        `${API_BASE}/api/github-models/generate`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, system })
        },
        LONG_TIMEOUT_MS
    );
    const data = await safeJson<{ response?: string; error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.error || 'GitHub Models generation failed');
    return typeof data.response === 'string' ? data.response : String(data.response ?? '');
}

/**
 * Gemini API
 */
export interface GeminiModel {
    name: string;
    provider: string;
    tier: string;
}

export async function getGeminiModels(): Promise<GeminiModel[]> {
    try {
        const response = await fetch(`${API_BASE}/api/gemini/models`);
        if (!response.ok) return [];
        const data = await safeJson<{ models?: GeminiModel[] }>(response);
        return data.models || [];
    } catch {
        return [];
    }
}

export async function generateWithGemini(prompt: string, model?: string, system?: string): Promise<string> {
    const response = await fetchWithTimeout(
        `${API_BASE}/api/gemini/generate`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, system })
        },
        LONG_TIMEOUT_MS
    );
    const data = await safeJson<{ response?: string; error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.error || 'Gemini generation failed');
    return typeof data.response === 'string' ? data.response : String(data.response ?? '');
}

/**
 * AnythingLLM API
 */
export async function getAnythingLLMWorkspaces(): Promise<Workspace[]> {
    try {
        const response = await fetch(`${API_BASE}/api/anythingllm/workspaces`);
        if (!response.ok) return [];
        const data = await safeJson<{ workspaces?: Workspace[] }>(response);
        return data.workspaces || [];
    } catch {
        return [];
    }
}

export async function chatWithAnythingLLM(workspace: string, message: string, mode?: string): Promise<string> {
    const response = await fetch(`${API_BASE}/api/anythingllm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace, message, mode })
    });
    const data = await safeJson<{ response?: string; error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.error || 'AnythingLLM chat failed');
    return typeof data.response === 'string' ? data.response : String(data.response ?? '');
}

/**
 * Chat Messages API
 */
export async function getChatMessages(chatId?: string): Promise<any[]> {
    const url = chatId
        ? `${API_BASE}/api/chat/messages?chatId=${chatId}`
        : `${API_BASE}/api/chat/messages`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Chat: HTTP ${response.status}`);
    const data = await safeJson<{ messages?: any[] }>(response);
    return data.messages || [];
}

/**
 * Tools API
 */
export async function getTools(): Promise<any[]> {
    const response = await fetch(`${API_BASE}/api/tools`);
    if (!response.ok) throw new Error(`Tools: HTTP ${response.status}`);
    const data = await safeJson<{ tools?: any[] }>(response);
    return data.tools || [];
}

/**
 * System Control API (Mission Control 2.0)
 */
export interface ServiceState {
    id: string;
    status: 'online' | 'offline' | 'starting' | 'stopping' | 'unknown';
    pid?: number;
    lastCheck?: string;
    error?: string;
}

export async function getServiceStatus(): Promise<ServiceState[]> {
    const response = await fetch(`${API_BASE}/api/system/status`);
    if (!response.ok) throw new Error(`Státusz: HTTP ${response.status}`);
    const data = await safeJson<{ services?: ServiceState[] }>(response);
    return data.services || [];
}

export async function startService(service: 'ollama' | 'python' | 'anythingllm'): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/system/start-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
    });
    const data = await safeJson<{ success?: boolean; message?: string }>(response).catch(() => ({}));
    return { success: data.success ?? false, message: data.message ?? `HTTP ${response.status}` };
}

export async function stopService(service: 'ollama' | 'python'): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/system/stop-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
    });
    const data = await safeJson<{ success?: boolean; message?: string }>(response).catch(() => ({}));
    return { success: data.success ?? false, message: data.message ?? `HTTP ${response.status}` };
}

export async function executeTool(toolName: string, args: any): Promise<any> {
    const response = await fetch(`${API_BASE}/api/tools/${encodeURIComponent(toolName)}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
    });
    const data = await safeJson<{ result?: any; error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.error || 'Tool execution failed');
    return data.result;
}

/**
 * Files API
 */
export interface FileInfo {
    name: string;
    isDirectory: boolean;
    path: string;
    size: number;
    modified: string;
}

export async function listFiles(path: string = '.'): Promise<FileInfo[]> {
    const response = await fetch(`${API_BASE}/api/files/list?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error(`Files: HTTP ${response.status}`);
    const data = await safeJson<{ files?: FileInfo[] }>(response);
    return data.files || [];
}

export async function getFileContent(path: string): Promise<string> {
    const response = await fetch(`${API_BASE}/api/files/content?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error(`File Content: HTTP ${response.status}`);
    const data = await safeJson<{ content?: string }>(response);
    return data.content || '';
}

/**
 * Robotkéz (Browser-Use) API
 * Calls the Python Subsystem at http://localhost:8000
 */
const PYTHON_API_BASE = 'http://localhost:8000';

export interface BrowserStatus {
    status: 'running' | 'stopped';
    has_agent: boolean;
}

export async function startBrowser(instruction?: string): Promise<any> {
    const response = await fetchWithTimeout(`${PYTHON_API_BASE}/browser/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction })
    });
    return safeJson(response);
}

export async function stopBrowser(): Promise<any> {
    const response = await fetchWithTimeout(`${PYTHON_API_BASE}/browser/stop`, {
        method: 'POST'
    });
    return safeJson(response);
}

export async function getBrowserStatus(): Promise<BrowserStatus> {
    const response = await fetchWithTimeout(`${PYTHON_API_BASE}/browser/status`);
    return safeJson<BrowserStatus>(response);
}

export async function runRobotkezTest(level: 1 | 2 | 3): Promise<any> {
    const response = await fetchWithTimeout(`${PYTHON_API_BASE}/test/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
    }, 180000); // 3 minute timeout for tests
    return safeJson(response);
}

export async function getRobotkezScreenshot(): Promise<string> {
    return `${PYTHON_API_BASE}/browser/screenshot/latest?t=${Date.now()}`;
}
