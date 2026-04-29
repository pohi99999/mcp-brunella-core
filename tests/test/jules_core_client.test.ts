import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JulesAICoreClient, JulesFixResponse } from '@packages/core-logic/julesMock.js';
import type { DeploymentAnalysis } from '@packages/utils/deploymentAnalyzer.js';

describe('JulesAICoreClient', () => {
  const originalEnv = process.env;
  const mockAnalysis: DeploymentAnalysis = {
    category: 'build',
    errors: ['Error: foo'],
    summary: 'Build failed due to foo',
    confidence: 0.9,
    suggestions: []
  };

  const mockApiResponse: JulesFixResponse = {
    status: 'success',
    fixes: [
      {
        file: 'test.ts',
        change: 'fix',
        location: 'line 1',
        reason: 'reason'
      }
    ],
    explanation: 'explanation',
    confidence: 0.95,
    timestamp: '2023-01-01T00:00:00Z'
  };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should use mock response by default (JULES_MOCK_MODE=undefined)', async () => {
    delete process.env.JULES_MOCK_MODE;
    delete process.env.JULES_API_URL;

    const client = new JulesAICoreClient();
    const response = await client.generateFix(mockAnalysis);

    expect(response).toBeDefined();
    expect(response.status).toBe('success'); // Should return build_missing_import mock
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should use mock response when JULES_MOCK_MODE=true', async () => {
    process.env.JULES_MOCK_MODE = 'true';
    delete process.env.JULES_API_URL;

    const client = new JulesAICoreClient();
    const response = await client.generateFix(mockAnalysis);

    expect(response).toBeDefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should call remote API when JULES_API_URL is set', async () => {
    process.env.JULES_API_URL = 'http://api.jules.ai';
    process.env.JULES_API_KEY = 'test-key';

    // Mock successful fetch
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse
    } as Response);

    const client = new JulesAICoreClient();
    const response = await client.generateFix(mockAnalysis);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.jules.ai/v1/generate-fix',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
        })
      })
    );
    expect(response).toEqual(mockApiResponse);
  });

  it('should fail if JULES_API_KEY is missing when calling remote', async () => {
    process.env.JULES_API_URL = 'http://api.jules.ai';
    delete process.env.JULES_API_KEY;

    // Even if mock mode is enabled (default), API URL takes precedence for attempt
    // But since API key is missing inside callRemoteJulesAPI, it throws.
    // And since mock mode is enabled, it should catch and fallback to mock!

    const client = new JulesAICoreClient();
    const response = await client.generateFix(mockAnalysis);

    // Should fallback to mock
    expect(response).toBeDefined();
    // Verify it is a mock response (from mockResponses) not mockApiResponse
    expect(response.explanation).toContain('exec is not imported'); // build_missing_import
  });

  it('should throw error if JULES_API_KEY is missing and mock mode disabled', async () => {
    process.env.JULES_API_URL = 'http://api.jules.ai';
    delete process.env.JULES_API_KEY;
    process.env.JULES_MOCK_MODE = 'false';

    const client = new JulesAICoreClient();

    await expect(client.generateFix(mockAnalysis)).rejects.toThrow('Missing JULES_API_KEY');
  });

  it('should fallback to mock if API call fails and mock mode enabled', async () => {
    process.env.JULES_API_URL = 'http://api.jules.ai';
    process.env.JULES_API_KEY = 'test-key';

    // Mock failed fetch
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network Error'));

    const client = new JulesAICoreClient();
    const response = await client.generateFix(mockAnalysis);

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(response).toBeDefined(); // Fallback to mock
    expect(response.explanation).toContain('exec is not imported');
  });

  it('should throw if API call fails and mock mode disabled', async () => {
    process.env.JULES_API_URL = 'http://api.jules.ai';
    process.env.JULES_API_KEY = 'test-key';
    process.env.JULES_MOCK_MODE = 'false';

    // Mock failed fetch
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network Error'));

    const client = new JulesAICoreClient();

    await expect(client.generateFix(mockAnalysis)).rejects.toThrow('Network Error');
  });

  it('should throw if validation fails on API response', async () => {
    process.env.JULES_API_URL = 'http://api.jules.ai';
    process.env.JULES_API_KEY = 'test-key';
    process.env.JULES_MOCK_MODE = 'false';

    // Mock invalid response
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'invalid' }) // Invalid shape
    } as Response);

    const client = new JulesAICoreClient();

    await expect(client.generateFix(mockAnalysis)).rejects.toThrow('Invalid response format');
  });
});
