import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { logInfo, logError } from '../utils/logger.js';
import { normalizeTrackDod, type TrackDodChecklist } from '../utils/trackDod.js';

export type SdlcPhase = 'architect' | 'devops' | 'coder' | 'qa' | 'reviewer';
export type SdlcPhaseStatus = 'pending' | 'running' | 'completed' | 'failed';

interface SdlcPhaseData {
  status: SdlcPhaseStatus;
  agent: string;
  output: string;
  completedAt?: string;
  error?: string;
}

interface SdlcBlock {
  enabled: boolean;
  current_phase: SdlcPhase;
  auto_advance: boolean;
  phases: Record<SdlcPhase, SdlcPhaseData>;
}

interface MetaJson {
  id: string;
  status: string;
  progress: number;
  dod?: TrackDodChecklist;
  sdlc?: SdlcBlock;
  [key: string]: unknown;
}

export interface SdlcStatus {
  enabled: boolean;
  currentPhase: SdlcPhase;
  phases: Record<SdlcPhase, SdlcPhaseStatus>;
  complete: boolean;
}

export const PHASE_ORDER: SdlcPhase[] = [
  'architect', 'devops', 'coder', 'qa', 'reviewer',
];

const PHASE_AGENTS: Record<SdlcPhase, string> = {
  architect: 'Copilot: bas-mcp-architect | Runtime: SpecWriterAgent',
  devops:    'Copilot: devops-infra-guardian | Runtime: DependencyGraphAgent',
  coder:     'Copilot: bas-lead-developer | Runtime: DeveloperAgent',
  qa:        'Copilot: robust-test-writer | Runtime: EvaluatorAgent',
  reviewer:  'Copilot: bas-phoenix-reviewer + strict-code-reviewer | Runtime fallback: EvaluatorAgent',
};

const TS_PHASE_AGENTS: Record<SdlcPhase, string> = {
  architect: 'SpecWriterAgent',
  devops:    'DependencyGraphAgent',
  coder:     'DeveloperAgent',
  qa:        'EvaluatorAgent',
  reviewer:  'EvaluatorAgent',
};

const PHASE_OUTPUTS: Record<SdlcPhase, string> = {
  architect: 'phases/1-architect.md',
  devops:    'phases/2-devops.md',
  coder:     'phases/3-coder.md',
  qa:        'phases/4-qa.md',
  reviewer:  'phases/5-reviewer.md',
};

/** Internal EventEmitter — avoids touching the closed PhoenixEventMap type. */
export const sdlcEvents = new EventEmitter();

// ─── helpers ────────────────────────────────────────────────────────────────

function readMeta(trackDir: string): MetaJson {
  const p = path.join(trackDir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(p, 'utf-8')) as MetaJson;
  return {
    ...meta,
    dod: normalizeTrackDod(meta.dod),
  };
}

function writeMeta(trackDir: string, meta: MetaJson): void {
  const normalized = {
    ...meta,
    dod: normalizeTrackDod(meta.dod),
  };
  fs.writeFileSync(path.join(trackDir, 'meta.json'), JSON.stringify(normalized, null, 2), 'utf-8');
}

function renderPhaseOutput(
  phase: SdlcPhase,
  agentName: string,
  result: { message?: string; data?: unknown; recoveryAttempts?: number },
): string {
  let serializedData = '';
  if (typeof result.data !== 'undefined') {
    try {
      serializedData = `\n## Runtime data\n\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n`;
    } catch {
      serializedData = `\n## Runtime data\n\n${String(result.data)}\n`;
    }
  }

  const recoveryLine = typeof result.recoveryAttempts === 'number'
    ? `- Recovery attempts: ${result.recoveryAttempts}\n`
    : '';

  return [
    `# ${phase} phase`,
    '',
    'Generated from the runtime executor result because no explicit phase artifact was written.',
    '',
    `- Runtime executor: ${agentName}`,
    `- Generated at: ${new Date().toISOString()}`,
    recoveryLine.trimEnd(),
    '',
    '## Summary',
    '',
    result.message || 'Phase completed successfully.',
    serializedData.trimEnd(),
    '',
  ].filter(Boolean).join('\n');
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Called by ProjectConductorAgent.createTrack() after saveState().
 * Writes the `sdlc` block into meta.json and creates the phases/ dir.
 * Idempotent: if the sdlc block already exists, does nothing.
 */
export function init(trackId: string, trackDir: string): void {
  const meta = readMeta(trackDir);
  if (meta.sdlc) return; // already initialised

  const sdlcBlock: SdlcBlock = {
    enabled: true,
    current_phase: 'architect',
    auto_advance: true,
    phases: Object.fromEntries(
      PHASE_ORDER.map((phase) => [
        phase,
        { status: 'pending' as SdlcPhaseStatus, agent: PHASE_AGENTS[phase], output: PHASE_OUTPUTS[phase] },
      ])
    ) as Record<SdlcPhase, SdlcPhaseData>,
  };

  meta.sdlc = sdlcBlock;
  writeMeta(trackDir, meta);

  const phasesDir = path.join(trackDir, 'phases');
  if (!fs.existsSync(phasesDir)) {
    fs.mkdirSync(phasesDir, { recursive: true });
  }

  logInfo('sdlcPipeline', `SDLC initialised for track: ${trackId}`);
  sdlcEvents.emit('sdlc:phase:start', { trackId, phase: 'architect' as SdlcPhase });
}

/** Returns the current SDLC status for a track. */
export function getStatus(trackId: string, trackDir: string): SdlcStatus {
  const meta = readMeta(trackDir);
  if (!meta.sdlc) {
    return {
      enabled: false,
      currentPhase: 'architect',
      phases: Object.fromEntries(PHASE_ORDER.map((p) => [p, 'pending'])) as Record<SdlcPhase, SdlcPhaseStatus>,
      complete: false,
    };
  }
  const { sdlc } = meta;
  return {
    enabled: sdlc.enabled,
    currentPhase: sdlc.current_phase,
    phases: Object.fromEntries(PHASE_ORDER.map((p) => [p, sdlc.phases[p].status])) as Record<SdlcPhase, SdlcPhaseStatus>,
    complete: PHASE_ORDER.every((p) => sdlc.phases[p].status === 'completed'),
  };
}

/** Runs a specific phase using AgentManager.executeWithRecovery(). */
export async function runPhase(trackId: string, trackDir: string, phase: SdlcPhase): Promise<void> {
  const meta = readMeta(trackDir);
  if (!meta.sdlc || !meta.sdlc.enabled) return;

  meta.sdlc.phases[phase].status = 'running';
  meta.sdlc.current_phase = phase;
  writeMeta(trackDir, meta);
  sdlcEvents.emit('sdlc:phase:start', { trackId, phase });
  logInfo('sdlcPipeline', `SDLC phase running: ${phase} — ${trackId}`);

  try {
    const { agentManager } = await import('../agents/AgentManager.js');
    const agentName = TS_PHASE_AGENTS[phase];
    const instruction = `SDLC ${phase} phase for track ${trackId}. Write output to ${PHASE_OUTPUTS[phase]}.`;
    const result = await agentManager.executeWithRecovery(agentName, instruction, { trackId, trackDir, phase });

    if (!result.success) {
      throw new Error(result.message || `SDLC ${phase} phase failed`);
    }

    // Ensure output file exists (generate one from the runtime result if needed)
    const outputPath = path.join(trackDir, PHASE_OUTPUTS[phase]);
    if (!fs.existsSync(outputPath)) {
      const phasesDir = path.dirname(outputPath);
      if (!fs.existsSync(phasesDir)) fs.mkdirSync(phasesDir, { recursive: true });
      fs.writeFileSync(outputPath, renderPhaseOutput(phase, agentName, result), 'utf-8');
    }

    const updated = readMeta(trackDir);
    if (updated.sdlc) {
      updated.sdlc.phases[phase].status = 'completed';
      updated.sdlc.phases[phase].completedAt = new Date().toISOString();
      writeMeta(trackDir, updated);
    }

    sdlcEvents.emit('sdlc:phase:complete', { trackId, phase });
    logInfo('sdlcPipeline', `SDLC phase complete: ${phase} — ${trackId}`);
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    const updated = readMeta(trackDir);
    if (updated.sdlc) {
      updated.sdlc.phases[phase].status = 'failed';
      updated.sdlc.phases[phase].error = error;
      writeMeta(trackDir, updated);
    }
    logError('sdlcPipeline', `SDLC phase failed: ${phase} — ${error}`);
    throw e;
  }
}

/**
 * Advances to the next pending phase (called automatically when auto_advance is true).
 * Emits `sdlc:complete` when all phases are done and sets track status to "testing".
 */
export async function advance(trackId: string, trackDir: string): Promise<void> {
  const meta = readMeta(trackDir);
  if (!meta.sdlc || !meta.sdlc.enabled) return;

  const nextPhase = PHASE_ORDER.find((p) => meta.sdlc!.phases[p].status === 'pending');
  if (!nextPhase) {
    sdlcEvents.emit('sdlc:complete', { trackId });
    // Update track status to "testing"
    const finished = readMeta(trackDir);
    finished.status = 'testing';
    writeMeta(trackDir, finished);
    logInfo('sdlcPipeline', `SDLC pipeline complete — track ${trackId} → testing`);
    return;
  }

  await runPhase(trackId, trackDir, nextPhase);

  // Re-read after runPhase to check auto_advance
  const after = readMeta(trackDir);
  if (after.sdlc?.auto_advance) {
    await advance(trackId, trackDir);
  }
}

/** Resets all phases to pending (useful for re-running). */
export async function reset(trackId: string, trackDir: string): Promise<void> {
  const meta = readMeta(trackDir);
  if (!meta.sdlc) return;
  PHASE_ORDER.forEach((p) => {
    if (meta.sdlc) {
      meta.sdlc.phases[p].status = 'pending';
      delete meta.sdlc.phases[p].completedAt;
      delete meta.sdlc.phases[p].error;
    }

    const outputPath = path.join(trackDir, PHASE_OUTPUTS[p]);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  });
  meta.sdlc.current_phase = 'architect';
  meta.status = 'active';
  writeMeta(trackDir, meta);
  logInfo('sdlcPipeline', `SDLC reset for ${trackId}`);
}
