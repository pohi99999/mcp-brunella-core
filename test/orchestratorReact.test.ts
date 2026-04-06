import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { OrchestratorAgent } from '../src/agents/OrchestratorAgent.js';
import * as bifrostGateway from '../src/core/bifrost_gateway.js';
import { agentManager } from '../src/agents/AgentManager.js';
import { socketService } from '../src/server/SocketService.js';
import type { AgentResponse } from '../src/agents/types.js';

// Mock the gateway
vi.mock('../src/core/bifrost_gateway.js', () => {
    const mockGenerate = vi.fn();
    return {
        getBifrostGateway: () => ({
            generate: mockGenerate
        })
    };
});

// Mock agent manager
vi.mock('../src/agents/AgentManager.js', () => ({
    agentManager: {
        listAgentDefinitions: vi.fn().mockReturnValue([{ name: 'testAgent', description: 'test', role: 'test' }]),
        listAgentStatuses: vi.fn().mockReturnValue([{ name: 'testAgent', status: 'idle' }]),
        queueTask: vi.fn().mockResolvedValue(123)
    }
}));

// Mock socket service
vi.mock('../src/server/SocketService.js', () => ({
    socketService: {
        broadcastChatter: vi.fn()
    }
}));

describe('OrchestratorAgent ReAct Loop', () => {
    let orchestrator: OrchestratorAgent;
    let mockGenerate: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        orchestrator = new OrchestratorAgent();
        mockGenerate = bifrostGateway.getBifrostGateway().generate;
    });

    it('should handle a simple function call and return the final message', async () => {
        // First iteration: LLM decides to call delegate_task
        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "",
            toolCalls: [{
                id: "call_1",
                function: {
                    name: "delegate_task",
                    arguments: JSON.stringify({ agent_name: "testAgent", instruction: "do something" })
                }
            }]
        });

        // Second iteration: LLM sees the tool result and provides a final response
        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "A feladatot sikeresen kiosztottam a testAgent-nek.",
            toolCalls: undefined
        });

        const result = await orchestrator.execute("Kérlek, csinálj valamit", {});

        // Verify agentManager was called
        expect(agentManager.queueTask).toHaveBeenCalledWith("do something", "testAgent", {});
        
        // Verify final result
        const response = result as AgentResponse & { taskIds?: number[] };
        expect(response.status).toBe("success");
        expect(response.message).toBe("A feladatot sikeresen kiosztottam a testAgent-nek.");
        expect(response.taskIds).toContain(123);
    });

    it('should handle send_message_to_user tool call', async () => {
        // First iteration: LLM decides to send a message
        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "",
            toolCalls: [{
                id: "call_1",
                function: {
                    name: "send_message_to_user",
                    arguments: JSON.stringify({ message: "Értettem, dolgozom rajta." })
                }
            }]
        });

        // Second iteration: LLM finishes
        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "Kész.",
            toolCalls: undefined
        });

        await orchestrator.execute("Üzenj nekem", {});

        // Verify socketService was called
        expect(socketService.broadcastChatter).toHaveBeenCalledWith('Brunella', 'Értettem, dolgozom rajta.', 'user');
    });

    it('should exit after MAX_ITERATIONS to prevent infinite loops', async () => {
        // LLM always returns a tool call
        mockGenerate.mockResolvedValue({
            success: true,
            content: "",
            toolCalls: [{
                id: "call_loop",
                function: {
                    name: "get_agent_status",
                    arguments: JSON.stringify({ agent_name: "testAgent" })
                }
            }]
        });

        const result = await orchestrator.execute("Végtelen hurok", {});

        // Should hit max iterations (5)
        expect(mockGenerate).toHaveBeenCalledTimes(5);
        const response = result as AgentResponse;
        expect(response.status).toBe("error");
        expect(response.error).toContain("maximális iterációszámot");
    });
});
