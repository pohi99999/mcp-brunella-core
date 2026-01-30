/**
 * Custom hook to initialize Dashboard data from backend API
 */

import { useEffect, useState } from 'react';
import { useMcpStore } from '@/lib/mcpStore';
import * as api from '@/lib/apiService';
import { toast } from 'sonner';

export function useDashboardData() {
    const { setAgentTools, setServerState, setConnected } = useMcpStore();

    useEffect(() => {
        let mounted = true;

        async function initializeData() {
            try {
                // Check health
                const health = await api.checkHealth();
                
                if (mounted) {
                    setConnected(true);
                    setServerState({
                        status: health.status === 'ok' ? 'running' : 'error',
                        lastUpdated: health.timestamp
                    });

                    // Show warnings for unhealthy services
                    const so = (s: { status?: string } | string) => (typeof s === 'object' ? s?.status : s) ?? '';
                    if (so(health.services.ollama) === 'unhealthy') {
                        toast.warning('Ollama nem elérhető', {
                            description: 'Az Ollama service nem fut. Indítsd el: ollama serve',
                        });
                    }
                    if (so(health.services.anythingllm) === 'unhealthy') {
                        toast.warning('AnythingLLM nem elérhető', {
                            description: 'Az AnythingLLM service nem érhető el.',
                        });
                    }
                }

                // Load agents as tools
                const agents = await api.getAgents();
                if (mounted) {
                    const agentTools = agents.map(agent => ({
                        id: `agent-${agent.name.toLowerCase()}`,
                        name: agent.name,
                        description: agent.description,
                        enabled: true,
                        category: 'server' as const,
                        parameters: [
                            { name: 'task', type: 'string', required: true },
                            { name: 'context', type: 'object', required: false }
                        ]
                    }));
                    setAgentTools(agentTools);
                }

                // Load additional tools
                const tools = await api.getTools();
                if (mounted && tools.length > 0) {
                    const toolsFormatted = tools.map((tool: any) => ({
                        id: tool.id || `tool-${tool.name}`,
                        name: tool.name,
                        description: tool.description || '',
                        enabled: tool.enabled !== false,
                        category: tool.category || 'custom' as const,
                        parameters: tool.parameters || []
                    }));
                    setAgentTools(prev => [...prev, ...toolsFormatted]);
                }

            } catch (error: any) {
                console.error('Failed to initialize dashboard data:', error);
                if (mounted) {
                    setConnected(false);
                    toast.error('Kapcsolódási hiba', {
                        description: 'Nem sikerült kapcsolódni a szerverhez.'
                    });
                }
            }
        }

        initializeData();

        return () => {
            mounted = false;
        };
    }, [setAgentTools, setServerState, setConnected]);
}

export function useOllamaModels() {
    const [models, setModels] = useState<api.OllamaModel[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadModels() {
            try {
                const data = await api.getOllamaModels();
                if (mounted) {
                    setModels(data);
                }
            } catch (error) {
                console.warn('Failed to load Ollama models:', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadModels();

        return () => {
            mounted = false;
        };
    }, []);

    return { models, loading };
}

export function useAnythingLLMWorkspaces() {
    const [workspaces, setWorkspaces] = useState<api.Workspace[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadWorkspaces() {
            try {
                const data = await api.getAnythingLLMWorkspaces();
                if (mounted) {
                    setWorkspaces(data);
                }
            } catch (error) {
                console.warn('Failed to load AnythingLLM workspaces:', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadWorkspaces();

        return () => {
            mounted = false;
        };
    }, []);

    return { workspaces, loading };
}
