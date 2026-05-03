export interface WorkingMemoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface WorkingMemoryState {
  summary: string;
  recentMessages: WorkingMemoryMessage[];
  recentToolObservations: string[];
  unresolvedGoals: string[];
  tokenEstimate: number;
  maxTokens: number;
}

const DEFAULT_MAX_TOKENS = 4_000;
const RECENT_MESSAGE_LIMIT = 8;
const TOOL_OBSERVATION_LIMIT = 6;
const GOAL_LIMIT = 5;

function estimateTokens(messages: WorkingMemoryMessage[]): number {
  return messages.reduce((sum, message) => sum + Math.ceil(message.content.length / 4), 0);
}

function summarizeMessages(messages: WorkingMemoryMessage[]): string {
  const normalized = messages
    .map((message) => `${message.role}: ${message.content.replace(/\s+/g, ' ').trim()}`)
    .filter(Boolean);

  if (normalized.length === 0) {
    return 'Nincs még összefoglalható session kontextus.';
  }

  const head = normalized.slice(0, 3);
  const tail = normalized.slice(-3);
  const merged = [...head, ...tail.filter((item) => !head.includes(item))];
  return merged.join(' | ').slice(0, 1000);
}

export function createWorkingMemoryState(maxTokens = DEFAULT_MAX_TOKENS): WorkingMemoryState {
  return {
    summary: 'Nincs még összefoglalható session kontextus.',
    recentMessages: [],
    recentToolObservations: [],
    unresolvedGoals: [],
    tokenEstimate: 0,
    maxTokens,
  };
}

export function appendWorkingMemoryMessage(
  state: WorkingMemoryState,
  message: WorkingMemoryMessage,
): WorkingMemoryState {
  const recentMessages = [...state.recentMessages, { ...message, content: message.content.slice(0, 1000) }];
  const boundedMessages = recentMessages.slice(-RECENT_MESSAGE_LIMIT);
  const tokenEstimate = estimateTokens(boundedMessages);
  const needsCompaction = tokenEstimate > state.maxTokens;
  const compactedMessages = needsCompaction ? boundedMessages.slice(-5) : boundedMessages;

  return {
    ...state,
    recentMessages: compactedMessages,
    tokenEstimate: estimateTokens(compactedMessages),
    summary: summarizeMessages(needsCompaction ? boundedMessages : compactedMessages),
  };
}

export function recordWorkingMemoryObservation(
  state: WorkingMemoryState,
  observation: string,
): WorkingMemoryState {
  return {
    ...state,
    recentToolObservations: [...state.recentToolObservations, observation.slice(0, 280)].slice(-TOOL_OBSERVATION_LIMIT),
  };
}

export function rememberWorkingMemoryGoal(
  state: WorkingMemoryState,
  goal: string,
): WorkingMemoryState {
  const normalized = goal.trim();
  if (!normalized) {
    return state;
  }

  const deduped = [...state.unresolvedGoals.filter((item) => item !== normalized), normalized].slice(-GOAL_LIMIT);
  return {
    ...state,
    unresolvedGoals: deduped,
  };
}

export function resolveWorkingMemoryGoal(
  state: WorkingMemoryState,
  goal: string,
): WorkingMemoryState {
  return {
    ...state,
    unresolvedGoals: state.unresolvedGoals.filter((item) => item !== goal),
  };
}

export function resolveLatestWorkingMemoryGoal(state: WorkingMemoryState): WorkingMemoryState {
  if (state.unresolvedGoals.length === 0) {
    return state;
  }

  return {
    ...state,
    unresolvedGoals: state.unresolvedGoals.slice(0, -1),
  };
}

export function formatWorkingMemory(state: WorkingMemoryState): string {
  const observations = state.recentToolObservations.length > 0
    ? state.recentToolObservations.join(' | ')
    : 'nincs';
  const goals = state.unresolvedGoals.length > 0
    ? state.unresolvedGoals.join(' | ')
    : 'nincs';

  return [
    `- Working memory összefoglaló: ${state.summary}`,
    `- Rövid távú tool observationök: ${observations}`,
    `- Nyitott célok: ${goals}`,
    `- Token becslés: ${state.tokenEstimate}/${state.maxTokens}`,
  ].join('\n');
}

export interface WorkingMemoryAwareResult {
  message: string;
  metadata?: Record<string, unknown>;
}

export function attachWorkingMemoryObservation<T extends WorkingMemoryAwareResult>(
  result: T,
  observation: string,
): T {
  const existing = typeof result.metadata?.workingMemory === 'object' && result.metadata?.workingMemory !== null
    ? result.metadata.workingMemory as Record<string, unknown>
    : {};
  const prior = Array.isArray(existing.recentToolObservations)
    ? existing.recentToolObservations.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    ...result,
    metadata: {
      ...(result.metadata ?? {}),
      workingMemory: {
        ...existing,
        recentToolObservations: [...prior, observation].slice(-TOOL_OBSERVATION_LIMIT),
      },
    },
  };
}