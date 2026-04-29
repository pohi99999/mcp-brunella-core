import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing the module
vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

vi.mock('@packages/core-logic/structuredMemory.js', () => ({
  queryMemory: vi.fn().mockReturnValue([
    { agentName: 'TestAgent', task: 'test task', confidence: 0.9, reuseCount: 3 }
  ]),
  getMemoryStats: vi.fn().mockReturnValue({
    summary: { total: 10, avgConfidence: 0.8 },
    agents: [{ name: 'TestAgent', count: 5 }]
  }),
}));

vi.mock('@packages/core-logic/patternReuse.js', () => ({
  checkPattern: vi.fn().mockReturnValue({ matched: false, threshold: 0.7 }),
  getPatternReuseThreshold: vi.fn().mockReturnValue(0.7),
}));

vi.mock('@packages/core-logic/userPreferences.js', () => ({
  getPreferenceContext: vi.fn().mockReturnValue('User prefers Hungarian language'),
  queryPreferences: vi.fn().mockReturnValue([{ key: 'lang', value: 'hu' }]),
  initSchema: vi.fn(),
}));

vi.mock('@packages/core-logic/goldenDatasetBridge.js', () => ({
  getGoldenStats: vi.fn().mockResolvedValue({ totalSamples: 42, avgQuality: 0.85 }),
  autoSaveGoldenSample: vi.fn().mockResolvedValue(undefined),
  calculateQuality: vi.fn().mockReturnValue(0.8),
}));

// Mock dynamic imports for lazy-loaded modules
vi.mock('@packages/core-logic/graphRagEngine.js', () => ({
  GraphRagEngine: {
    getInstance: vi.fn().mockReturnValue({
      queryContext: vi.fn().mockReturnValue({
        relevantNodes: [
          { type: 'agent', label: 'MarketingAgent' },
          { type: 'concept', label: 'campaign' }
        ],
        edges: [],
      }),
      getStats: vi.fn().mockReturnValue({ nodes: 50, edges: 120, lessons: 15 }),
      storeLesson: vi.fn(),
    }),
  },
}));

vi.mock('@packages/core-logic/reflectionEngine.js', () => ({
  ReflectionEngine: {
    getInstance: vi.fn().mockReturnValue({
      reflect: vi.fn().mockResolvedValue({
        lesson: 'Task succeeded with pattern X',
        qualityScore: 0.85,
      }),
      getReflectionContext: vi.fn().mockReturnValue('Recent lessons: pattern X works well'),
      getStats: vi.fn().mockReturnValue({ totalReflections: 20, avgQuality: 0.7 }),
    }),
  },
}));

vi.mock('@packages/core-logic/sharedCognition.js', () => ({
  SharedCognition: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockReturnValue({ entries: [], confidence: 0.5 }),
    store: vi.fn().mockReturnValue({ id: 'cog-1' }),
    getStats: vi.fn().mockReturnValue({ total: 5, avgConfidence: 0.7 }),
  })),
}));

vi.mock('@packages/core-logic/selfModel.js', () => ({
  SelfModel: vi.fn().mockImplementation(() => ({
    getState: vi.fn().mockReturnValue({ identity: 'Brunella', capabilities: ['coding'] }),
    ingestSignal: vi.fn().mockReturnValue({ signalId: 'sig-1' }),
  })),
}));

vi.mock('@packages/core-logic/metaReasoner.js', () => ({
  MetaReasoner: vi.fn().mockImplementation(() => ({
    getInsights: vi.fn().mockReturnValue([{ category: 'pattern', description: 'X works' }]),
    recordDecision: vi.fn().mockReturnValue({ id: 'dec-1' }),
    getStats: vi.fn().mockReturnValue({ decisions: 10, insights: 3 }),
  })),
}));

vi.mock('@packages/core-logic/predictiveIntelligence.js', () => ({
  PredictiveIntelligence: {
    getInstance: vi.fn().mockReturnValue({
      getActiveAlerts: vi.fn().mockReturnValue([]),
      getPredictiveContext: vi.fn().mockReturnValue('No anomalies detected'),
      getStats: vi.fn().mockReturnValue({ signals: 100, alerts: 0 }),
    }),
  },
}));

vi.mock('@packages/core-logic/collectiveMind.js', () => ({
  CollectiveMind: vi.fn().mockImplementation(() => ({
    getStats: vi.fn().mockReturnValue({ total: 8, avgConfidence: 0.75 }),
    buildConsensus: vi.fn().mockReturnValue({ consensus: 'agreed', confidence: 0.9 }),
  })),
}));

describe('CopilotCognitiveBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enrich()', () => {
    it('should enrich query with all 11 layers', async () => {
      const { enrich } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const result = await enrich({ query: 'média kampány tervezés', userId: 'peter' });

      expect(result).toBeDefined();
      expect(result.query).toBe('média kampány tervezés');
      expect(result.timestamp).toBeTruthy();
      expect(result.layers).toBeInstanceOf(Array);
      expect(result.layers.length).toBe(11);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return layer names for all 11 systems', async () => {
      const { enrich } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const result = await enrich({ query: 'test query' });

      const layerNames = result.layers.map(l => l.layer);
      expect(layerNames).toContain('StructuredMemory');
      expect(layerNames).toContain('PatternReuse');
      expect(layerNames).toContain('UserPreferences');
      expect(layerNames).toContain('GraphRAG');
      expect(layerNames).toContain('SharedCognition');
      expect(layerNames).toContain('ReflectionEngine');
      expect(layerNames).toContain('GoldenDataset');
      expect(layerNames).toContain('SelfModel');
      expect(layerNames).toContain('MetaReasoner');
      expect(layerNames).toContain('PredictiveIntelligence');
      expect(layerNames).toContain('CollectiveMind');
    });

    it('should extract recommended agents from GraphRAG', async () => {
      const { enrich } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const result = await enrich({ query: 'marketing campaign' });

      expect(result.recommendedAgents).toContain('MarketingAgent');
    });

    it('should build a summary string', async () => {
      const { enrich } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const result = await enrich({ query: 'test' });

      expect(result.summary).toBeTruthy();
      expect(typeof result.summary).toBe('string');
    });

    it('should handle default parameters', async () => {
      const { enrich } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const result = await enrich({ query: 'minimal query' });

      expect(result.layers.length).toBe(11);
    });
  });

  describe('reflect()', () => {
    it('should store reflection across multiple layers', async () => {
      const { reflect } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const result = await reflect({
        taskId: 'task-001',
        agentName: 'MarketingAgent',
        task: 'Create marketing campaign',
        result: 'Campaign plan generated successfully',
        success: true,
        confidence: 0.9,
      });

      expect(result.stored).toBe(true);
      expect(result.layers.length).toBeGreaterThan(0);
      expect(result.layers).toContain('ReflectionEngine');
      expect(result.layers).toContain('GraphRAG');
      expect(result.layers).toContain('GoldenDataset');
      expect(result.layers).toContain('MetaReasoner');
      expect(result.layers).toContain('SelfModel');
      expect(result.layers).toContain('SharedCognition');
    });

    it('should extract lesson from reflection', async () => {
      const { reflect } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const result = await reflect({
        taskId: 'task-002',
        agentName: 'TestAgent',
        task: 'test task',
        result: 'success',
        success: true,
      });

      expect(result.lesson).toBeTruthy();
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('should skip golden dataset for failed tasks', async () => {
      const { reflect } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const { autoSaveGoldenSample } = await import('@packages/core-logic/goldenDatasetBridge.js');

      const result = await reflect({
        taskId: 'task-003',
        agentName: 'TestAgent',
        task: 'failing task',
        result: 'error occurred',
        success: false,
        confidence: 0.2,
      });

      expect(result.stored).toBe(true);
      expect(result.layers).not.toContain('GoldenDataset');
      expect(autoSaveGoldenSample).not.toHaveBeenCalled();
    });
  });

  describe('getCognitiveStats()', () => {
    it('should return stats from all layers', async () => {
      const { getCognitiveStats } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const stats = await getCognitiveStats();

      expect(stats.timestamp).toBeTruthy();
      expect(stats.totalLayers).toBeGreaterThanOrEqual(10);
      expect(stats.activeLayers).toBeGreaterThan(0);
      expect(stats.layers).toBeDefined();
      expect(typeof stats.layers).toBe('object');
    });

    it('should include StructuredMemory stats', async () => {
      const { getCognitiveStats } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const stats = await getCognitiveStats();

      expect(stats.layers['StructuredMemory']).toBeDefined();
      expect(stats.layers['StructuredMemory'].status).toBe('active');
    });

    it('should include GraphRAG stats', async () => {
      const { getCognitiveStats } = await import('@packages/core-logic/copilotCognitiveBridge.js');
      const stats = await getCognitiveStats();

      expect(stats.layers['GraphRAG']).toBeDefined();
      expect(stats.layers['GraphRAG'].status).toBe('active');
    });
  });
});
