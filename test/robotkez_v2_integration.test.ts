import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RobotkezV2Agent } from '../src/agents/RobotkezV2Agent';
import { persistentBrowser } from '../src/utils/persistentBrowser';

// Mock persistentBrowser
vi.mock('../src/utils/persistentBrowser', () => ({
  persistentBrowser: {
    sendCommand: vi.fn(),
  },
}));

// Mock logger to avoid clutter
vi.mock('../src/utils/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

// Mock backgroundTaskManager
vi.mock('../src/utils/backgroundTaskManager', () => ({
  backgroundTaskManager: {
    startTask: vi.fn(),
  },
}));

// Mock llmPlanner
vi.mock('../src/utils/llmPlanner', () => ({
  generateExecutionPlan: vi.fn(),
}));

describe('RobotkezV2Agent Integration', () => {
  let agent: RobotkezV2Agent;

  beforeEach(() => {
    agent = new RobotkezV2Agent();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle "navigálj" command with specific URL', async () => {
    const task = 'Navigálj a https://example.com oldalra';

    // Mock browser response
    vi.mocked(persistentBrowser.sendCommand).mockResolvedValue({
      status: 'success',
      url: 'https://example.com',
      screenshot: 'base64image'
    });

    const result = await agent.executeTask({ task });

    expect(persistentBrowser.sendCommand).toHaveBeenCalledWith({
      action: 'navigate',
      url: 'https://example.com'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Sikeresen végrehajtottam');
    // The agent logic might perform a final screenshot if the previous command didn't return one,
    // or if the plan includes a screenshot step.
    // In the simple parsing, "Navigálj..." creates a single step plan.
    // The execution loop collects results.
    // The final data.screenshot comes from persistentBrowser.sendCommand({action: 'screenshot'}) if called,
    // OR from the last result if we modify the agent to use it.
    // Currently the agent code calls an explicit 'screenshot' at the end (Phase 5 of executeTask).
    // So we need to mock that too or ensure the first call covers it.
  });

  it('should handle "kattints" command with selector', async () => {
    const task = "Kattints a '#submit-btn' gombra";

    vi.mocked(persistentBrowser.sendCommand).mockResolvedValue({
      status: 'success',
      message: 'Clicked #submit-btn',
      screenshot: 'click-screenshot'
    });

    const result = await agent.executeTask({ task });

    // Check if the correct command was sent
    expect(persistentBrowser.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
            action: 'click',
            selector: '#submit-btn'
        })
    );

    expect(result.success).toBe(true);
  });

  it('should return helpful Hungarian error message on failure', async () => {
    const task = 'Navigálj a https://bad-url.com oldalra';

    vi.mocked(persistentBrowser.sendCommand).mockRejectedValue(new Error('Network error'));

    const result = await agent.executeTask({ task });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Sajnos nem sikerült');
    expect(result.message).toContain('Network error');
  });
});
