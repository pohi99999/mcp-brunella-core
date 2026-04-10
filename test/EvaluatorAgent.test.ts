import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Stats } from 'fs';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import { EvaluatorAgent } from '../src/agents/EvaluatorAgent.js';
import type { GenerateResponse } from '../src/core/bifrost_gateway.js';
import { socketService } from '../src/server/SocketService.js';

const mockGenerate = vi.hoisted(() => vi.fn());
const mockBaseAgent = vi.hoisted(() => class {
  capabilities: string[] = [];
});
const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
const mockLoggerInstance = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const mockBroadcastChatter = vi.hoisted(() => vi.fn());
const mockSocketService = vi.hoisted(() => ({
  broadcastChatter: mockBroadcastChatter,
}));
const mockSocketServiceClass = vi.hoisted(() =>
  vi.fn().mockImplementation(() => mockSocketService)
);
const mockExecSync = vi.hoisted(() => vi.fn());

vi.mock('../src/core/bifrost_gateway.js', () => ({
  getBifrostGateway: () => ({
    generate: mockGenerate,
  }),
}));

vi.mock('../src/agents/BaseAgent.js', () => ({
  BaseAgent: mockBaseAgent,
}));

vi.mock('fs/promises', () => ({
  default: mockFs,
  mkdir: mockFs.mkdir,
  stat: mockFs.stat,
  readFile: mockFs.readFile,
  writeFile: mockFs.writeFile,
}));

vi.mock('child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  setAgentStatus: vi.fn(),
  Logger: vi.fn().mockImplementation(() => mockLoggerInstance),
}));

vi.mock('../src/server/SocketService.js', () => ({
  SocketServiceClass: vi.fn().mockImplementation(() => ({
    broadcastChatter: mockBroadcastChatter,
  })),
  socketService: {
    broadcastChatter: mockBroadcastChatter,
  },
}));

function createStats(size: number): Stats {
  return { size } as Stats;
}

function makeGenerateResponse(overrides: Partial<GenerateResponse> & Pick<GenerateResponse, 'success' | 'provider' | 'model' | 'duration_ms'>): GenerateResponse {
  return overrides as GenerateResponse;
}

describe('EvaluatorAgent', () => {
  const agent = new EvaluatorAgent();
  const datasetTask = 'Verify if data/training/golden_dataset.jsonl has increased in size';
  const datasetFilePath = 'data/training/golden_dataset.jsonl';
  const sanitizedBaselineName = 'data_training_golden_dataset_jsonl.json';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.mkdir).mockReset();
    vi.mocked(fs.stat).mockReset();
    vi.mocked(fs.readFile).mockReset();
    vi.mocked(fs.writeFile).mockReset();
    mockGenerate.mockReset();
    mockExecSync.mockReset();
    mockBroadcastChatter.mockReset();
    mockSocketServiceClass.mockClear();
    mockLoggerInstance.info.mockReset();
    mockLoggerInstance.warn.mockReset();
    mockLoggerInstance.error.mockReset();
  });

  it('should return file not found when dataset file is missing and skip baseline write', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockRejectedValue({ code: 'ENOENT', message: 'missing dataset' });

    const result = await agent.executeTask({ task: datasetTask });

    expect(result.success).toBe(false);
    expect(result.message).toBe(`File not found: ${datasetFilePath}. Cannot verify growth.`);
    expect(result.data).toEqual({ filePath: datasetFilePath, error: 'missing dataset' });
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should create baseline from zero when baseline file is missing and dataset exists', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue(createStats(128));
    vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT', message: 'baseline missing' });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await agent.executeTask({ task: datasetTask });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Dataset growth verified');
    expect(result.data).toMatchObject({
      filePath: datasetFilePath,
      currentSize: 128,
      previousSize: 0,
      hasGrown: true,
    });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);

    const [baselineUrl, baselineJson, encoding] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(baselineUrl)).toContain(sanitizedBaselineName);
    expect(String(baselineJson)).toContain('"size": 128');
    expect(encoding).toBe('utf-8');
  });

  it('should report growth when current size exceeds baseline and persist new baseline', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue(createStats(256));
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      size: 64,
      timestamp: '2026-04-01T00:00:00.000Z',
    }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await agent.executeTask({ task: datasetTask });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Dataset growth verified');
    expect(result.data).toMatchObject({
      filePath: datasetFilePath,
      currentSize: 256,
      previousSize: 64,
      hasGrown: true,
    });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('should normalize unknown throwables when filesystem throws non-error and return failure message', async () => {
    vi.mocked(fs.mkdir).mockRejectedValue({ message: 'boom' });

    const result = await agent.executeTask({ task: datasetTask });

    expect(result.success).toBe(false);
    expect(result.message).toBe(`Failed to verify dataset growth for ${datasetFilePath}: boom`);
    expect(result.data).toEqual({ filePath: datasetFilePath, error: 'boom' });
  });

  it('should execute ReAct tool call when task requires shell execution and return final LLM message', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    mockGenerate.mockResolvedValueOnce(makeGenerateResponse({
      success: true,
      provider: 'github',
      model: 'gpt-4.1',
      duration_ms: 1,
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'run_shell_command',
            arguments: JSON.stringify({ command: 'npm test' }),
          },
        },
      ],
    }));
    mockGenerate.mockResolvedValueOnce(makeGenerateResponse({
      success: true,
      provider: 'github',
      model: 'gpt-4.1',
      duration_ms: 1,
      content: 'Kész a feladat.',
    }));
    mockExecSync.mockReturnValue('Command Output');

    const result = await agent.executeTask({ task: 'Run the project tests' });

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(execSync).toHaveBeenCalledWith('npm test', { encoding: 'utf-8', stdio: 'pipe' });
    expect(mockBroadcastChatter).toHaveBeenCalledWith('Evaluator', 'Teszt futtatása: npm test', 'system');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Kész a feladat.');
    expect(result.data).toMatchObject({ testOutput: 'Command Output' });
    expect(socketService.broadcastChatter).toHaveBeenCalledWith('Evaluator', 'Kész a feladat.', 'assistant');
  });
});
