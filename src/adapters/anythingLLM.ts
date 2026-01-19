/**
 * AnythingLLM Adapter
 * 
 * This module provides integration with AnythingLLM for intelligent conversation
 * and document management capabilities.
 */

import axios, { AxiosInstance } from 'axios';

interface AnythingLLMConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  response: string;
  sources?: string[];
  error?: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
}

export class AnythingLLMAdapter {
  private client: AxiosInstance;
  private config: AnythingLLMConfig;

  constructor(config: AnythingLLMConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Test connection to AnythingLLM API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.get('/api/v1/system/ping');
      
      if (response.status === 200) {
        return {
          success: true,
          message: 'Successfully connected to AnythingLLM'
        };
      }
      
      return {
        success: false,
        message: `Unexpected response status: ${response.status}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Send a chat message and get response
   */
  async chat(
    workspaceSlug: string, 
    message: string, 
    history?: ChatMessage[]
  ): Promise<ChatResponse> {
    try {
      const response = await this.client.post(`/api/v1/workspace/${workspaceSlug}/chat`, {
        message,
        history: history || [],
        mode: 'chat'
      });

      return {
        response: response.data.textResponse || response.data.response,
        sources: response.data.sources || []
      };
    } catch (error: any) {
      return {
        response: '',
        error: `Chat failed: ${error.message}`
      };
    }
  }

  /**
   * List available workspaces
   */
  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    try {
      const response = await this.client.get('/api/v1/workspaces');
      return response.data.workspaces || [];
    } catch (error: any) {
      console.error('Failed to list workspaces:', error.message);
      return [];
    }
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(name: string): Promise<{ success: boolean; workspace?: WorkspaceInfo; error?: string }> {
    try {
      const response = await this.client.post('/api/v1/workspace/new', {
        name
      });

      return {
        success: true,
        workspace: response.data.workspace
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create workspace: ${error.message}`
      };
    }
  }

  /**
   * Upload document to workspace
   */
  async uploadDocument(
    workspaceSlug: string,
    content: string,
    filename: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await this.client.post(`/api/v1/workspace/${workspaceSlug}/upload`, {
        content,
        filename
      });

      return {
        success: true,
        message: 'Document uploaded successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to upload document: ${error.message}`
      };
    }
  }

  /**
   * Query documents in workspace
   */
  async queryDocuments(
    workspaceSlug: string,
    query: string
  ): Promise<{ results: any[]; error?: string }> {
    try {
      const response = await this.client.post(`/api/v1/workspace/${workspaceSlug}/query`, {
        query
      });

      return {
        results: response.data.results || []
      };
    } catch (error: any) {
      return {
        results: [],
        error: `Query failed: ${error.message}`
      };
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<any> {
    try {
      const response = await this.client.get('/api/v1/system');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get system info:', error.message);
      return null;
    }
  }
}

/**
 * Create AnythingLLM adapter from environment variables
 */
export function createAnythingLLMAdapter(): AnythingLLMAdapter | null {
  const apiUrl = process.env.ANYTHINGLLM_API_URL || 'http://localhost:3001';
  const apiKey = process.env.ANYTHINGLLM_API_KEY;

  if (!apiKey) {
    console.warn('AnythingLLM API key not configured');
    return null;
  }

  return new AnythingLLMAdapter({
    apiUrl,
    apiKey,
    timeout: 30000
  });
}

/**
 * Test AnythingLLM connection with dummy request
 */
export async function testAnythingLLMConnection(): Promise<void> {
  console.log('Testing AnythingLLM connection...');
  
  const adapter = createAnythingLLMAdapter();
  
  if (!adapter) {
    console.log('✗ AnythingLLM not configured (missing API key)');
    return;
  }

  const result = await adapter.testConnection();
  
  if (result.success) {
    console.log('✓', result.message);
    
    // Try to list workspaces
    const workspaces = await adapter.listWorkspaces();
    console.log(`✓ Found ${workspaces.length} workspace(s)`);
    
    if (workspaces.length > 0) {
      console.log('  Workspaces:', workspaces.map(w => w.name).join(', '));
    }
  } else {
    console.log('✗', result.message);
  }
}
