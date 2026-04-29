import { describe, it, expect, beforeAll, vi } from 'vitest';
import { InnovationBridgeAgent } from '@packages/agents/InnovationBridgeAgent.js';

// Mock LLM client
vi.mock('@packages/core-logic/llm_client.js', () => ({
  generateResponse: vi.fn(),
}));

// Mock RAG utilities (LanceDB not available in test env)
vi.mock('@packages/utils/rag.js', () => ({
  searchRAG: vi.fn().mockResolvedValue([]),
  addToIndex: vi.fn().mockResolvedValue(undefined),
}));

import { generateResponse } from '@packages/core-logic/llm_client.js';

describe('InnovationBridgeAgent', () => {
  let agent: InnovationBridgeAgent;

  beforeAll(() => {
    agent = new InnovationBridgeAgent();
  });

  it('should have correct metadata', () => {
    expect(agent.name).toBe('InnovationBridge');
    expect(agent.role).toBe('Cross-Industry Innovation Transfer Specialist');
    expect(agent.capabilities).toContain('problem_abstraction');
    expect(agent.capabilities).toContain('triz_analysis');
    expect(agent.capabilities).toContain('cross_industry_search');
    expect(agent.capabilities).toContain('analogy_matching');
    expect(agent.capabilities).toContain('innovation_reporting');
  });

  it('should return error when problem is too short', async () => {
    const result = await agent.execute('Help');

    expect(result.status).toBe('error');
    expect(result.error).toContain('Problem megadása szükséges');
  });

  it('should extract problem from task string', async () => {
    const task = 'Find innovation for: How to reduce hospital cleaning time?';
    const problemMatch = task.match(/(?:find innovation for|problem|challenge):?\s*(.+)/i);
    
    expect(problemMatch).toBeTruthy();
    expect(problemMatch?.[1]).toBe('How to reduce hospital cleaning time?');
  });

  it('should accept problem via context', async () => {
    const context = {
      problem: 'How to reduce wait times in emergency rooms?',
      industry: 'Healthcare',
    };

    expect(context.problem).toBe('How to reduce wait times in emergency rooms?');
    expect(context.industry).toBe('Healthcare');
  });

  it('should abstract problem with TRIZ (mocked)', async () => {
    const mockLLMResponse = `{
      "abstractChallenge": "Minimize resource transition time under constraints",
      "trizPrinciples": [1, 15, 28],
      "searchKeywords": ["rapid changeover", "SMED", "quick setup", "lean manufacturing"]
    }`;

    (generateResponse as any).mockResolvedValueOnce(mockLLMResponse);

    const abstractProblem = await agent.abstractProblem(
      'How to reduce hospital operating room cleaning time?',
      'Healthcare'
    );

    expect(abstractProblem.originalProblem).toBe('How to reduce hospital operating room cleaning time?');
    expect(abstractProblem.originalIndustry).toBe('Healthcare');
    expect(abstractProblem.abstractChallenge).toContain('transition time');
    expect(abstractProblem.trizPrinciples.length).toBeGreaterThan(0);
    expect(abstractProblem.searchKeywords.length).toBeGreaterThan(0);
  });

  it('should handle LLM failure with fallback', async () => {
    (generateResponse as any).mockRejectedValueOnce(new Error('LLM timeout'));

    const abstractProblem = await agent.abstractProblem(
      'How to improve efficiency?',
      'Manufacturing'
    );

    // Should return fallback
    expect(abstractProblem.abstractChallenge).toBe('Optimization and efficiency improvement challenge');
    expect(abstractProblem.searchKeywords).toContain('optimization');
  });

  it('should find cross-industry solutions (mocked)', async () => {
    const mockAbstractProblem = {
      originalProblem: 'Reduce cleaning time',
      originalIndustry: 'Healthcare',
      abstractChallenge: 'Minimize downtime between operations',
      trizPrinciples: [{ id: 1, name: 'Segmentation', description: 'Divide into parts' }],
      searchKeywords: ['rapid changeover', 'SMED'],
    };

    const mockSolutionsResponse = `[
      {
        "sourceIndustry": "Formula 1 Racing",
        "solutionDescription": "Pit stop methodology - parallel task execution, pre-positioned tools",
        "applicability": "Apply pit crew techniques to OR cleaning",
        "confidence": 90,
        "source": "McLaren F1 Team"
      },
      {
        "sourceIndustry": "Aviation",
        "solutionDescription": "Aircraft turnaround procedures - checklists and parallel workflows",
        "applicability": "Adapt aviation turnaround checklists for OR cleaning",
        "confidence": 85
      }
    ]`;

    (generateResponse as any).mockResolvedValueOnce(mockSolutionsResponse);

    const solutions = await agent.findCrossIndustrySolutions(mockAbstractProblem, 'Healthcare');

    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0].sourceIndustry).not.toContain('Healthcare');
    expect(solutions[0].confidence).toBeGreaterThan(0);
  });

  it('should generate markdown report', () => {
    const mockProblem = {
      originalProblem: 'How to reduce wait times?',
      originalIndustry: 'Healthcare',
      abstractChallenge: 'Optimize queue management',
      trizPrinciples: [{ id: 1, name: 'Segmentation', description: 'Divide object' }],
      searchKeywords: ['queue', 'optimization'],
    };

    const mockSolutions = [
      {
        sourceIndustry: 'Fast Food',
        solutionDescription: 'Drive-thru parallel serving lanes',
        applicability: 'Create multiple check-in lanes',
        confidence: 80,
      },
    ];

    const report = agent.generateReport(mockProblem, mockSolutions);

    expect(report).toContain('Innovation Bridge Report');
    expect(report).toContain('Original Problem');
    expect(report).toContain('Healthcare');
    expect(report).toContain('Fast Food');
    expect(report).toContain('TRIZ');
    expect(report).toContain('Next Steps');
  });

  it('should execute full workflow (mocked)', async () => {
    const mockAbstractResponse = `{
      "abstractChallenge": "Minimize transition time",
      "trizPrinciples": [1, 15],
      "searchKeywords": ["rapid changeover", "SMED"]
    }`;

    const mockSolutionsResponse = `[
      {
        "sourceIndustry": "Formula 1",
        "solutionDescription": "Pit stop methodology",
        "applicability": "Apply to hospital OR cleaning",
        "confidence": 90
      }
    ]`;

    (generateResponse as any)
      .mockResolvedValueOnce(mockAbstractResponse)
      .mockResolvedValueOnce(mockSolutionsResponse);

    const result = await agent.execute('Find innovation for: Reduce hospital cleaning time', {
      industry: 'Healthcare',
    });

    expect(result.status).toBe('success');
    expect(result.data).toHaveProperty('problem');
    expect(result.data).toHaveProperty('solutions');
    expect(result.data).toHaveProperty('markdown');
    expect(result.metadata?.solutionCount).toBeGreaterThan(0);
  });
});

describe('InnovationBridgeAgent - TRIZ Principles', () => {
  it('should have TRIZ principles defined', () => {
    const agent = new InnovationBridgeAgent();
    // Access private property for testing
    const trizPrinciples = (agent as any).trizPrinciples;

    expect(trizPrinciples).toBeInstanceOf(Array);
    expect(trizPrinciples.length).toBeGreaterThan(0);
    expect(trizPrinciples[0]).toHaveProperty('id');
    expect(trizPrinciples[0]).toHaveProperty('name');
    expect(trizPrinciples[0]).toHaveProperty('description');
  });
});
