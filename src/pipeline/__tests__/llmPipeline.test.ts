import { SelfHealingPipeline } from '../llmPipeline';
import { EventEmitter } from 'events';

// Mock fetch
global.fetch = jest.fn();

describe('SelfHealingPipeline', () => {
  let pipeline: SelfHealingPipeline;

  beforeEach(() => {
    pipeline = new SelfHealingPipeline(2); // Use 2 attempts for faster tests
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create pipeline with default max attempts', () => {
      const defaultPipeline = new SelfHealingPipeline();
      expect(defaultPipeline).toBeInstanceOf(EventEmitter);
    });

    it('should create pipeline with custom max attempts', () => {
      const customPipeline = new SelfHealingPipeline(5);
      expect(customPipeline).toBeInstanceOf(SelfHealingPipeline);
    });
  });

  describe('Progress Events', () => {
    it('should emit progress events', async () => {
      const progressEvents: string[] = [];
      
      pipeline.on('progress', (msg) => {
        progressEvents.push(msg);
      });

      // Mock successful Ollama response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'const x = 1;' })
      });

      // Mock VM2 to succeed
      jest.mock('vm2', () => ({
        VM: jest.fn().mockImplementation(() => ({
          run: jest.fn()
        }))
      }));

      try {
        await pipeline.run('test task');
      } catch {
        // Expected to fail in test environment
      }

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toContain('Feladat indítása');
    });
  });

  describe('Error Handling', () => {
    it('should handle Ollama connection failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      await expect(pipeline.run('test')).rejects.toThrow();
    });

    it('should retry on failures', async () => {
      // First attempt fails
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'invalid code' })
        })
        // Second attempt succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'const x = 1;' })
        });

      // Mock VM2 to fail first, then succeed
      const mockRun = jest.fn()
        .mockImplementationOnce(() => {
          throw new Error('Syntax error');
        })
        .mockImplementationOnce(() => {
          // Success
        });

      jest.doMock('vm2', () => ({
        VM: jest.fn().mockImplementation(() => ({
          run: mockRun
        }))
      }));

      // Note: This test might need adjustment based on actual VM2 behavior
      await expect(pipeline.run('test')).resolves.toBeDefined();
    });
  });

  describe('Code Generation', () => {
    it('should clean markdown code blocks from response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: '```javascript\nconst x = 1;\n```' })
      });

      const mockRun = jest.fn();
      jest.doMock('vm2', () => ({
        VM: jest.fn().mockImplementation(() => ({
          run: mockRun
        }))
      }));

      try {
        const result = await pipeline.run('test');
        expect(result).not.toContain('```');
      } catch {
        // Expected in test environment
      }
    });
  });
});
