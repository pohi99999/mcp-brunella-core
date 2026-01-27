// src/types/buap.ts

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params?: any;
    id?: number | string;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: any;
    error?: { code: number; message: string; data?: any };
    id: number | string | null;
}

export interface AgentManifest {
    id: string;
    name: string;
    capabilities: string[]; // Simple list for now
}

export interface HandshakeRequest {
    agent_id: string;
    capabilities: string[];
}

export interface DelegateRequest {
    target_agent_id: string;
    task: {
        type: string;
        content: any;
    };
}

export interface MessageRequest {
    target_agent_id: string;
    content: string;
}

// Internal Router Types
export interface AgentSession {
    id: string;
    socket: any; // Can be a WebSocket or a Process (stdin/stdout wrapper)
    send: (msg: JsonRpcResponse | JsonRpcRequest) => void;
}
