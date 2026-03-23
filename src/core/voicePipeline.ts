/**
 * Voice Pipeline — Phase 3
 * Transcript → Remote Command mapping
 *
 * Takes a raw voice transcript and resolves it to the best matching
 * registered MCP tool + inputs for the remote session to execute.
 *
 * Matching is keyword/regex based (v1). A confidence score [0–1]
 * is returned; callers should gate execution above a threshold (0.5).
 */

import { logInfo, logWarn } from '../utils/logger.js';
import { remoteEventBridge } from './remoteEventBridge.js';
import type { VoiceInputRequest, VoiceInputResponse, VoiceMappedCommand } from './types/remote.js';

// ─── Intent Rule Registry ─────────────────────────────────────────────────────

interface IntentRule {
  /** Regex tested against the lowercased transcript */
  pattern: RegExp;
  toolName: string;
  targetId: string;
  /** Map named capture groups from the pattern to tool inputs */
  mapInput: (match: RegExpMatchArray) => Record<string, unknown>;
  baseConfidence: number;
}

const INTENT_RULES: IntentRule[] = [
  {
    pattern: /(?:nyisd meg|open|read)\s+(?<path>\S+)/i,
    toolName: 'file_read',
    targetId: 'local',
    mapInput: m => ({ path: m.groups?.path ?? '' }),
    baseConfidence: 0.85,
  },
  {
    pattern: /(?:írd|write|save)\s+(?<content>.+)\s+(?:into|to)\s+(?<path>\S+)/i,
    toolName: 'file_write',
    targetId: 'local',
    mapInput: m => ({ path: m.groups?.path ?? '', content: m.groups?.content ?? '' }),
    baseConfidence: 0.80,
  },
  {
    pattern: /(?:futtasd|run|execute)\s+(?<agentId>\w[\w-]*)/i,
    toolName: 'agent_run',
    targetId: 'orchestrator',
    mapInput: m => ({ agentId: m.groups?.agentId ?? '' }),
    baseConfidence: 0.80,
  },
  {
    pattern: /(?:status|állapot|check)\s+(?<agentId>\w[\w-]*)/i,
    toolName: 'agent_status',
    targetId: 'orchestrator',
    mapInput: m => ({ agentId: m.groups?.agentId ?? '' }),
    baseConfidence: 0.75,
  },
  {
    pattern: /(?:stop|állítsd le|halt)\s+(?<agentId>\w[\w-]*)/i,
    toolName: 'agent_stop',
    targetId: 'orchestrator',
    mapInput: m => ({ agentId: m.groups?.agentId ?? '' }),
    baseConfidence: 0.85,
  },
  {
    pattern: /(?:help|segítség|commands)/i,
    toolName: 'remote_help',
    targetId: 'system',
    mapInput: () => ({}),
    baseConfidence: 0.90,
  },
];

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Map a voice transcript to the best matching remote command.
 * Returns the mapped command (above threshold) or a failure response.
 */
export function mapVoiceToCommand(req: VoiceInputRequest): VoiceInputResponse {
  const text = req.transcript.trim();
  const lower = text.toLowerCase();

  let bestRule: IntentRule | null = null;
  let bestMatch: RegExpMatchArray | null = null;
  let bestScore = 0;

  for (const rule of INTENT_RULES) {
    const match = text.match(rule.pattern) ?? lower.match(rule.pattern);
    if (match) {
      const score = rule.baseConfidence;
      if (score > bestScore) {
        bestScore = score;
        bestRule = rule;
        bestMatch = match;
      }
    }
  }

  const CONFIDENCE_THRESHOLD = 0.5;

  if (!bestRule || !bestMatch || bestScore < CONFIDENCE_THRESHOLD) {
    logWarn('VoicePipeline', `No mapping found for: "${text}" (score=${bestScore.toFixed(2)})`);

    remoteEventBridge.publish({
      type: 'voice:unmapped',
      source: 'VoicePipeline',
      sessionId: req.sessionId,
      payload: { transcript: text, score: bestScore },
    });

    return {
      mapped: false,
      reason: `No intent matched (best score: ${bestScore.toFixed(2)})`,
    };
  }

  const command: VoiceMappedCommand = {
    toolName: bestRule.toolName,
    targetId: bestRule.targetId,
    input: bestRule.mapInput(bestMatch),
    confidence: bestScore,
    rawTranscript: text,
  };

  logInfo(
    'VoicePipeline',
    `Mapped sessionId=${req.sessionId} tool=${command.toolName} confidence=${bestScore.toFixed(2)}`
  );

  remoteEventBridge.publish({
    type: 'voice:mapped',
    source: 'VoicePipeline',
    sessionId: req.sessionId,
    payload: { command },
  });

  return { mapped: true, command };
}

/** Returns the list of supported tool names for help/discovery endpoints. */
export function listVoiceIntents(): Array<{ tool: string; description: string; example: string }> {
  return [
    { tool: 'file_read',    description: 'Read a file',         example: 'open myfile.txt' },
    { tool: 'file_write',   description: 'Write to a file',     example: 'write hello into out.txt' },
    { tool: 'agent_run',    description: 'Run an agent',        example: 'run myAgent' },
    { tool: 'agent_status', description: 'Check agent status',  example: 'status myAgent' },
    { tool: 'agent_stop',   description: 'Stop an agent',       example: 'stop myAgent' },
    { tool: 'remote_help',  description: 'List all commands',   example: 'help' },
  ];
}
