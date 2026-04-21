import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from './index.js';

describe('BAS Cloudflare Orchestrator - AI Gateway', () => {
  const mockEnv = {
    FAST_MODEL: '@cf/meta/llama-3-8b-instruct',
    DEFAULT_CODE_MODEL: '@cf/meta/llama-3-8b-instruct',
    AI: {
      run: vi.fn(),
    },
    D1_METADATA: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
    },
    BAS_TASKS: {
      get: vi.fn(),
      put: vi.fn(),
    },
    SWARM_COORDINATOR: {
      idFromName: vi.fn().mockReturnValue('mock-id'),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response('mock swarm response')),
      }),
    },
    BAS_ANALYTICS: {
      writeDataPoint: vi.fn(),
    },
    AI_RATE_LIMITER: {
      limit: vi.fn().mockResolvedValue({ success: true }),
    },
    // Required Security Env
    BAS_API_KEY: 'test-api-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate AI response and log to D1', async () => {
    const requestBody = {
      prompt: 'Hello AI',
      model: '@cf/meta/llama-3-8b-instruct'
    };
    
    const mockAiResult = { response: 'Hello Human' };
    mockEnv.AI.run.mockResolvedValue(mockAiResult);

    const request = new Request('http://localhost/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAS-API-Key': 'test-api-key'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await worker.fetch(request, mockEnv as any);
    const result = await response.json() as any;

    expect(response.status).toBe(200);
    expect(result.result).toEqual(mockAiResult);
    expect(result.requestId).toBeDefined();
    
    // Verify D1 logging
    expect(mockEnv.D1_METADATA.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_calls')
    );
    expect(mockEnv.D1_METADATA.run).toHaveBeenCalled();
  });

  it('should return 400 if prompt is missing', async () => {
    const request = new Request('http://localhost/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAS-API-Key': 'test-api-key'
      },
      body: JSON.stringify({})
    });

    const response = await worker.fetch(request, mockEnv as any);
    expect(response.status).toBe(400);
  });

  it('should log failed AI calls to D1', async () => {
    const requestBody = { prompt: 'Bad prompt' };
    mockEnv.AI.run.mockRejectedValue(new Error('AI Error'));

    const request = new Request('http://localhost/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAS-API-Key': 'test-api-key'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await worker.fetch(request, mockEnv as any);
    expect(response.status).toBe(500);

    // Verify error logging in D1
    expect(mockEnv.D1_METADATA.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_calls')
    );
    expect(mockEnv.D1_METADATA.run).toHaveBeenCalled();
  });

  it('should return 429 if rate limit is exceeded', async () => {
    mockEnv.AI_RATE_LIMITER.limit.mockResolvedValueOnce({ success: false });

    const request = new Request('http://localhost/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAS-API-Key': 'test-api-key'
      },
      body: JSON.stringify({ prompt: 'Hello' })
    });

    const response = await worker.fetch(request, mockEnv as any);
    expect(response.status).toBe(429);
  });

  describe('Dispatch API', () => {
    it('should dispatch task to worker and log to D1', async () => {
      const routingResult = { worker_url: 'http://worker-agent' };
      mockEnv.D1_METADATA.first.mockResolvedValueOnce(routingResult);

      const request = new Request('http://localhost/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAS-API-Key': 'test-api-key'
        },
        body: JSON.stringify({ agent: 'TestAgent', task: 'Do something' })
      });

      // Global fetch mock
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ success: true, message: 'Done' })
      });

      const response = await worker.fetch(request, mockEnv as any);
      const result = await response.json() as any;

      expect(response.status).toBe(200);
      expect(result.status).toBe('completed');
      expect(mockEnv.D1_METADATA.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO worker_tasks')
      );
    });

    it('should return 404 if no routing found', async () => {
      mockEnv.D1_METADATA.first.mockResolvedValueOnce(null);

      const request = new Request('http://localhost/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAS-API-Key': 'test-api-key'
        },
        body: JSON.stringify({ agent: 'UnknownAgent', task: 'Do something' })
      });

      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(404);
    });
  });

  describe('KKV Data API', () => {
    it('should fetch clients', async () => {
      const mockClients = [{ id: '1', name: 'Client A' }];
      mockEnv.D1_METADATA.all.mockResolvedValueOnce({ results: mockClients });

      const request = new Request('http://localhost/kkv/clients', {
        headers: { 'X-BAS-API-Key': 'test-api-key' }
      });

      const response = await worker.fetch(request, mockEnv as any);
      const result = await response.json() as any;

      expect(response.status).toBe(200);
      expect(result).toEqual(mockClients);
    });

    it('should create a client', async () => {
      const request = new Request('http://localhost/kkv/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAS-API-Key': 'test-api-key'
        },
        body: JSON.stringify({ name: 'New Client', tax_number: '123' })
      });

      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(201);
      expect(mockEnv.D1_METADATA.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO clients')
      );
    });

    it('should create an invoice', async () => {
      const request = new Request('http://localhost/kkv/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAS-API-Key': 'test-api-key'
        },
        body: JSON.stringify({ client_id: '1', amount: 1000, currency: 'HUF' })
      });

      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(201);
      expect(mockEnv.D1_METADATA.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoices')
      );
    });
  });

  describe('Other Endpoints', () => {
    it('should list workers', async () => {
      mockEnv.D1_METADATA.all.mockResolvedValueOnce({ results: [] });
      const request = new Request('http://localhost/workers', {
        headers: { 'X-BAS-API-Key': 'test-api-key' }
      });
      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(200);
    });

    it('should show routing table', async () => {
      mockEnv.D1_METADATA.all.mockResolvedValueOnce({ results: [] });
      const request = new Request('http://localhost/routing', {
        headers: { 'X-BAS-API-Key': 'test-api-key' }
      });
      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(200);
    });

    it('should handle queue submission', async () => {
      const request = new Request('http://localhost/queue/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAS-API-Key': 'test-api-key'
        },
        body: JSON.stringify({ instruction: 'Test queue' })
      });
      // Mock TASK_QUEUE
      const mockEnvWithQueue = { ...mockEnv, TASK_QUEUE: { send: vi.fn() } };
      const response = await worker.fetch(request, mockEnvWithQueue as any);
      expect(response.status).toBe(202);
    });

    it('should handle artifact listing', async () => {
      const request = new Request('http://localhost/artifacts/test-agent', {
        headers: { 'X-BAS-API-Key': 'test-api-key' }
      });
      // Mock R2Bucket
      const mockEnvWithR2 = { ...mockEnv, R2_KNOWLEDGE: { list: vi.fn().mockResolvedValue({ objects: [] }) } };
      const response = await worker.fetch(request, mockEnvWithR2 as any);
      expect(response.status).toBe(200);
    });

    it('should handle zero-prompt summary', async () => {
      const request = new Request('http://localhost/zero-prompt/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAS-API-Key': 'test-api-key'
        },
        body: JSON.stringify({ summary: 'test' })
      });
      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(200);
    });

    it('should proxy swarm requests', async () => {
      const request = new Request('http://localhost/swarm/status', {
        headers: { 'X-BAS-API-Key': 'test-api-key' }
      });
      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(200);
      expect(mockEnv.SWARM_COORDINATOR.get).toHaveBeenCalled();
    });
  });
});
