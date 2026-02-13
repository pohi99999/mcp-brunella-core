/**
 * Git Auto-Recovery — Gold Protocol Phoenix (RULE-PH4)
 *
 * Automatic git checkpoint after 3rd retry failure.
 * Creates a safety commit with agent state before human intervention.
 *
 * @version 1.0.0
 */

import { logInfo, logError, logWarn } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface GitRecoveryResult {
  success: boolean;
  commitHash?: string;
  branch?: string;
  message?: string;
}

export interface RecoveryEvent {
  type: 'crash' | 'restart' | 'git_checkpoint' | 'failover';
  agent: string;
  details: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// RECOVERY LOG (in-memory, capped)
// ---------------------------------------------------------------------------

const MAX_LOG_SIZE = 100;
const recoveryLog: RecoveryEvent[] = [];

function addRecoveryEvent(event: RecoveryEvent): void {
  recoveryLog.push(event);
  if (recoveryLog.length > MAX_LOG_SIZE) {
    recoveryLog.shift();
  }
}

export function getRecoveryLog(): RecoveryEvent[] {
  return [...recoveryLog];
}

export function clearRecoveryLog(): void {
  recoveryLog.length = 0;
}

// ---------------------------------------------------------------------------
// GIT OPERATIONS
// ---------------------------------------------------------------------------

/**
 * Execute a git command and return stdout.
 */
async function execGit(args: string[], cwd?: string): Promise<string> {
  const { execSync } = await import('child_process');
  const workDir = cwd || process.cwd();
  const result = execSync(`git ${args.join(' ')}`, {
    cwd: workDir,
    encoding: 'utf-8',
    timeout: 15_000
  });
  return result.trim();
}

/**
 * Create a git safety checkpoint (RULE-PH4).
 *
 * Stages all changes and creates a tagged commit for recovery.
 * Called automatically when all retries are exhausted.
 */
export async function gitAutoCheckpoint(
  agentName: string,
  errorMessage: string
): Promise<GitRecoveryResult> {
  try {
    // Check if inside a git repo
    await execGit(['rev-parse', '--is-inside-work-tree']);

    // Get current branch
    const branch = await execGit(['rev-parse', '--abbrev-ref', 'HEAD']);

    // Check for uncommitted changes
    const status = await execGit(['status', '--porcelain']);
    if (!status) {
      logInfo('GitRecovery', 'No uncommitted changes — skipping checkpoint');
      addRecoveryEvent({
        type: 'git_checkpoint',
        agent: agentName,
        details: 'No changes to commit',
        timestamp: Date.now()
      });
      return { success: true, branch, message: 'No changes to checkpoint' };
    }

    // Stage all changes
    await execGit(['add', '-A']);

    // Create recovery commit
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const commitMsg = `[phoenix-recovery] ${agentName} checkpoint @ ${timestamp}\n\nError: ${errorMessage.slice(0, 200)}`;
    await execGit(['commit', '-m', commitMsg, '--no-verify']);

    // Get commit hash
    const commitHash = await execGit(['rev-parse', '--short', 'HEAD']);

    logWarn('GitRecovery', `Auto-checkpoint created: ${commitHash} (${agentName})`);

    addRecoveryEvent({
      type: 'git_checkpoint',
      agent: agentName,
      details: `Commit: ${commitHash} — ${errorMessage.slice(0, 100)}`,
      timestamp: Date.now()
    });

    return { success: true, commitHash, branch, message: `Recovery commit: ${commitHash}` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('GitRecovery', `Auto-checkpoint failed: ${msg}`);

    addRecoveryEvent({
      type: 'crash',
      agent: agentName,
      details: `Git checkpoint failed: ${msg}`,
      timestamp: Date.now()
    });

    return { success: false, message: msg };
  }
}

/**
 * Log a recovery event (for process restart tracking).
 */
export function logRecoveryEvent(
  type: RecoveryEvent['type'],
  agent: string,
  details: string
): void {
  const event: RecoveryEvent = { type, agent, details, timestamp: Date.now() };
  addRecoveryEvent(event);
  logInfo('GitRecovery', `Recovery event: [${type}] ${agent} — ${details}`);
}
