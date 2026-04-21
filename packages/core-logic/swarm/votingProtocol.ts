/**
 * Voting Protocol — Weighted voting and negotiation for Swarm colonies
 * Track #5: Swarm Intelligence v2 — Phase 2
 *
 * Implements weighted voting where agent weight = experience × confidence × successRate.
 * Supports multi-round negotiation (max 3 rounds) with leader tiebreaker.
 */

import { logInfo, logWarn } from '@packages/utils/logger.js';
import type { SwarmAgent } from '@packages/agents/swarm/SwarmAgent.js';

export interface Vote {
  agentId: string;
  option: string;
  confidence: number;     // 0–1
  reasoning: string;
  weight: number;         // auto-calculated
}

export interface VotingResult {
  winner: string;
  totalWeight: number;
  consensus: boolean;     // true if >70% weighted agreement
  rounds: number;
  votes: Vote[];
  tiebroken: boolean;
}

export interface NegotiationContext {
  question: string;
  options: string[];
  maxRounds: number;
  consensusThreshold: number; // default 0.7 (70%)
}

/**
 * Calculate agent weight for voting:
 * weight = experienceScore × confidence × recentSuccessRate
 */
function calculateWeight(agent: SwarmAgent, confidence: number): number {
  const stats = agent.getStats();
  const totalTasks = stats.completed + stats.failed;
  const experienceScore = Math.min(totalTasks / 10, 1.0); // normalize: 10+ tasks = max experience
  const recentSuccessRate = stats.successRate;

  return experienceScore * confidence * recentSuccessRate;
}

/**
 * Conduct a single round of weighted voting
 */
export function conductVoting(
  agents: SwarmAgent[],
  question: string,
  options: string[],
  voteFn: (agent: SwarmAgent, question: string, options: string[]) => { option: string; confidence: number; reasoning: string },
): VotingResult {
  const votes: Vote[] = [];

  for (const agent of agents) {
    try {
      const vote = voteFn(agent, question, options);
      if (!options.includes(vote.option)) continue; // invalid option, skip

      const weight = calculateWeight(agent, vote.confidence);
      votes.push({
        agentId: agent.agentId,
        option: vote.option,
        confidence: vote.confidence,
        reasoning: vote.reasoning,
        weight,
      });
    } catch {
      logWarn('VotingProtocol', `Agent ${agent.agentId} failed to vote`);
    }
  }

  if (votes.length === 0) {
    return {
      winner: options[0] ?? '',
      totalWeight: 0,
      consensus: false,
      rounds: 1,
      votes: [],
      tiebroken: true,
    };
  }

  return tallyVotes(votes, 0.7);
}

/**
 * Tally votes and determine winner
 */
function tallyVotes(votes: Vote[], consensusThreshold: number): VotingResult {
  const weightByOption = new Map<string, number>();

  for (const vote of votes) {
    weightByOption.set(vote.option, (weightByOption.get(vote.option) ?? 0) + vote.weight);
  }

  const totalWeight = Array.from(weightByOption.values()).reduce((a, b) => a + b, 0);

  // Find winner (highest total weight)
  let winner = '';
  let winnerWeight = -1;
  for (const [option, weight] of weightByOption) {
    if (weight > winnerWeight) {
      winnerWeight = weight;
      winner = option;
    }
  }

  const consensus = totalWeight > 0 ? (winnerWeight / totalWeight) >= consensusThreshold : false;

  return {
    winner,
    totalWeight,
    consensus,
    rounds: 1,
    votes,
    tiebroken: false,
  };
}

/**
 * Multi-round negotiation protocol:
 * Round 1: Initial vote → if no consensus →
 * Round 2: Share reasoning, re-vote → if no consensus →
 * Round 3: Final vote → if still no consensus → leader decides
 */
export function negotiate(
  agents: SwarmAgent[],
  leaderId: string | null,
  context: NegotiationContext,
  voteFn: (agent: SwarmAgent, question: string, options: string[], previousVotes?: Vote[]) => { option: string; confidence: number; reasoning: string },
): VotingResult {
  const { question, options, maxRounds, consensusThreshold } = context;

  let lastVotes: Vote[] = [];
  let bestResult: VotingResult | null = null;

  for (let round = 1; round <= maxRounds; round++) {
    const votes: Vote[] = [];

    for (const agent of agents) {
      try {
        const vote = voteFn(agent, question, options, round > 1 ? lastVotes : undefined);
        if (!options.includes(vote.option)) continue;

        const weight = calculateWeight(agent, vote.confidence);
        votes.push({
          agentId: agent.agentId,
          option: vote.option,
          confidence: vote.confidence,
          reasoning: vote.reasoning,
          weight,
        });
      } catch {
        logWarn('VotingProtocol', `Agent ${agent.agentId} failed in negotiation round ${round}`);
      }
    }

    if (votes.length === 0) continue;

    const result = tallyVotes(votes, consensusThreshold);
    result.rounds = round;
    lastVotes = votes;
    bestResult = result;

    logInfo('VotingProtocol', `Round ${round}: winner="${result.winner}" consensus=${result.consensus} weight=${result.totalWeight.toFixed(2)}`);

    if (result.consensus) {
      return result;
    }
  }

  // No consensus after max rounds → leader decides (tiebreaker)
  if (bestResult && !bestResult.consensus && leaderId) {
    const leaderVote = lastVotes.find(v => v.agentId === leaderId);
    if (leaderVote) {
      logInfo('VotingProtocol', `Leader tiebreaker: ${leaderId} chose "${leaderVote.option}"`);
      return {
        ...bestResult,
        winner: leaderVote.option,
        tiebroken: true,
      };
    }
  }

  return bestResult ?? {
    winner: options[0] ?? '',
    totalWeight: 0,
    consensus: false,
    rounds: maxRounds,
    votes: [],
    tiebroken: true,
  };
}
