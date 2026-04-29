import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

const normalizePath = (value: unknown): string => String(value).replaceAll('\\', '/');

vi.mock('fs');
vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    executeWithRecovery: vi.fn().mockResolvedValue({ success: true }),
  },
}));
vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

const TRACK_ID = 'test-track-20260406';
const TRACK_DIR = '/conductor/tracks/test-track-20260406';

const baseMeta = () =>
  JSON.stringify({ id: TRACK_ID, status: 'active', progress: 0 });

const metaWithSdlc = (currentPhase = 'architect', phases: Record<string, string> = {}) =>
  JSON.stringify({
    id: TRACK_ID,
    status: 'active',
    progress: 0,
    sdlc: {
      enabled: true,
      current_phase: currentPhase,
      auto_advance: false,
      phases: {
        architect: { status: phases['architect'] ?? 'pending', agent: 'x', output: 'phases/1-architect.md' },
        devops:    { status: phases['devops']    ?? 'pending', agent: 'x', output: 'phases/2-devops.md' },
        coder:     { status: phases['coder']     ?? 'pending', agent: 'x', output: 'phases/3-coder.md' },
        qa:        { status: phases['qa']        ?? 'pending', agent: 'x', output: 'phases/4-qa.md' },
        reviewer:  { status: phases['reviewer']  ?? 'pending', agent: 'x', output: 'phases/5-reviewer.md' },
      },
    },
  });

describe('sdlcPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(baseMeta());
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.mkdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    (fs.unlinkSync as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
  });

  describe('init()', () => {
    it('writes sdlc block to meta.json', async () => {
      const { init } = await import('@packages/core-logic/sdlcPipeline.js');
      init(TRACK_ID, TRACK_DIR);

      const { calls } = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock;
      const written = JSON.parse(calls[0][1] as string);
      expect(written.sdlc).toBeDefined();
      expect(written.sdlc.enabled).toBe(true);
      expect(written.sdlc.current_phase).toBe('architect');
      expect(written.sdlc.phases.architect.status).toBe('pending');
      expect(written.sdlc.phases.reviewer.status).toBe('pending');
    });

    it('creates phases/ directory', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { init } = await import('@packages/core-logic/sdlcPipeline.js');
      init(TRACK_ID, TRACK_DIR);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('phases'),
        expect.objectContaining({ recursive: true }),
      );
    });

    it('is idempotent when sdlc block already exists', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      const { init } = await import('@packages/core-logic/sdlcPipeline.js');
      init(TRACK_ID, TRACK_DIR);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('emits sdlc:phase:start with phase=architect', async () => {
      const { init, sdlcEvents } = await import('@packages/core-logic/sdlcPipeline.js');
      const spy = vi.fn();
      sdlcEvents.once('sdlc:phase:start', spy);
      init(TRACK_ID, TRACK_DIR);

      expect(spy).toHaveBeenCalledWith({ trackId: TRACK_ID, phase: 'architect' });
    });
  });

  describe('getStatus()', () => {
    it('returns disabled when no sdlc block', async () => {
      const { getStatus } = await import('@packages/core-logic/sdlcPipeline.js');
      const s = getStatus(TRACK_ID, TRACK_DIR);
      expect(s.enabled).toBe(false);
    });

    it('returns correct currentPhase and per-phase statuses', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        metaWithSdlc('devops', { architect: 'completed', devops: 'pending' }),
      );
      const { getStatus } = await import('@packages/core-logic/sdlcPipeline.js');
      const s = getStatus(TRACK_ID, TRACK_DIR);

      expect(s.enabled).toBe(true);
      expect(s.currentPhase).toBe('devops');
      expect(s.phases.architect).toBe('completed');
      expect(s.phases.devops).toBe('pending');
      expect(s.complete).toBe(false);
    });

    it('returns complete=true when all phases are completed', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        metaWithSdlc('reviewer', {
          architect: 'completed', devops: 'completed',
          coder: 'completed', qa: 'completed', reviewer: 'completed',
        }),
      );
      const { getStatus } = await import('@packages/core-logic/sdlcPipeline.js');
      const s = getStatus(TRACK_ID, TRACK_DIR);
      expect(s.complete).toBe(true);
    });
  });

  describe('reset()', () => {
    it('resets all phases to pending', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        metaWithSdlc('qa', { architect: 'completed', devops: 'completed', coder: 'completed' }),
      );
      const { reset } = await import('@packages/core-logic/sdlcPipeline.js');
      await reset(TRACK_ID, TRACK_DIR);

      const written = JSON.parse(
        (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string,
      );
      expect(written.sdlc.current_phase).toBe('architect');
      expect(written.sdlc.phases.architect.status).toBe('pending');
      expect(written.sdlc.phases.coder.status).toBe('pending');
      expect(written.status).toBe('active');
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('does nothing when no sdlc block', async () => {
      const { reset } = await import('@packages/core-logic/sdlcPipeline.js');
      await reset(TRACK_ID, TRACK_DIR);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('runPhase()', () => {
    it('calls AgentManager.executeWithRecovery with correct agent', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      const { runPhase } = await import('@packages/core-logic/sdlcPipeline.js');
      const { agentManager } = await import('@packages/agents/AgentManager.js');

      await runPhase(TRACK_ID, TRACK_DIR, 'architect');

      expect(agentManager.executeWithRecovery).toHaveBeenCalledWith(
        'SpecWriterAgent',
        expect.stringContaining('architect'),
        expect.objectContaining({ trackId: TRACK_ID, phase: 'architect' }),
      );
    });

    it('marks phase completed in meta.json', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      const { runPhase } = await import('@packages/core-logic/sdlcPipeline.js');
      await runPhase(TRACK_ID, TRACK_DIR, 'coder');

      const writes = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const lastMetaWrite = writes
        .filter((c: unknown[]) => (c[0] as string).endsWith('meta.json'))
        .at(-1);
      expect(lastMetaWrite).toBeDefined();
      const written = JSON.parse(lastMetaWrite![1] as string);
      expect(written.sdlc.phases.coder.status).toBe('completed');
    });

    it('writes generated phase output when the executor does not create one', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((target: unknown) => {
        const value = normalizePath(target);
        if (value.endsWith('phases/1-architect.md')) return false;
        return true;
      });

      const { runPhase } = await import('@packages/core-logic/sdlcPipeline.js');
      await runPhase(TRACK_ID, TRACK_DIR, 'architect');

      const writes = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const outputWrite = writes.find((c: unknown[]) => normalizePath(c[0]).endsWith('phases/1-architect.md'));
      expect(outputWrite).toBeDefined();
      expect(String(outputWrite?.[1])).toContain('Generated from the runtime executor result');
      expect(String(outputWrite?.[1])).toContain('SpecWriterAgent');
    });

    it('marks phase failed when recovery returns success=false', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      const { runPhase } = await import('@packages/core-logic/sdlcPipeline.js');
      const { agentManager } = await import('@packages/agents/AgentManager.js');
      (agentManager.executeWithRecovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        message: 'runtime fallback failed',
      });

      await expect(runPhase(TRACK_ID, TRACK_DIR, 'qa')).rejects.toThrow('runtime fallback failed');

      const writes = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const lastMetaWrite = writes
        .filter((c: unknown[]) => (c[0] as string).endsWith('meta.json'))
        .at(-1);
      expect(lastMetaWrite).toBeDefined();
      const written = JSON.parse(lastMetaWrite![1] as string);
      expect(written.sdlc.phases.qa.status).toBe('failed');
      expect(written.sdlc.phases.qa.error).toContain('runtime fallback failed');
    });
  });
});
