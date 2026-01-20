import { AgentManager } from '../AgentManager';
import { IAgent } from '../types';
import fs from 'fs';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../utils/rag');
jest.mock('../../pipeline/llmPipeline');
jest.mock('fs');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('AgentManager', () => {
  let agentManager: AgentManager;
  
  beforeEach(() => {
    // Mock registry.json
    const mockRegistry = {
      version: 1,
      agents: [
        {
          name: 'test-agent',
          title: 'Test Agent',
          description: 'A test agent',
          capabilities: ['test'],
          status: 'active'
        }
      ]
    };
    
    (mockedFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockRegistry));
    (mockedFs.existsSync as jest.Mock).mockReturnValue(true);
    
    agentManager = new AgentManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Agent Registration', () => {
    it('should register a new agent', () => {
      const agent: IAgent = {
        name: 'custom-agent',
        description: 'Custom agent',
        capabilities: ['custom'],
        execute: async () => 'result'
      };

      agentManager.registerAgent(agent);
      expect(agentManager.getAgent('custom-agent')).toBeDefined();
    });

    it('should list all registered agents', () => {
      const agents = agentManager.listAgents();
      expect(agents).toContain('researcher');
      expect(agents).toContain('developer');
    });

    it('should get agent by name', () => {
      const agent = agentManager.getAgent('researcher');
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('researcher');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = agentManager.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('Agent Delegation', () => {
    it('should delegate task to registered agent', async () => {
      const result = await agentManager.delegate('researcher', 'test query');
      expect(result).toBeDefined();
    });

    it('should throw error for non-existent agent', async () => {
      await expect(
        agentManager.delegate('non-existent', 'task')
      ).rejects.toThrow('Agent \'non-existent\' not found');
    });
  });

  describe('Agent Definitions', () => {
    it('should list agent definitions', () => {
      const definitions = agentManager.listAgentDefinitions();
      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBeGreaterThan(0);
    });

    it('should list registry definitions', () => {
      const definitions = agentManager.listRegistryDefinitions();
      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('Built-in Agents', () => {
    it('should have researcher agent registered', () => {
      const agent = agentManager.getAgent('researcher');
      expect(agent).toBeDefined();
      expect(agent?.capabilities).toContain('rag_search');
    });

    it('should have developer agent registered', () => {
      const agent = agentManager.getAgent('developer');
      expect(agent).toBeDefined();
      expect(agent?.capabilities).toContain('code_generation');
    });
  });
});
