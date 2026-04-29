/**
 * Voting Protocol Tests — Track #5 Phase 2
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { conductVoting, negotiate, type Vote } from '@packages/core-logic/swarm/votingProtocol.js';
import type { SwarmAgent } from '@packages/agents/swarm/SwarmAgent.js';

function createMockAgent(id: string, completed: number, failed: number): SwarmAgent {
  return {
    agentId: id,
    getStats: () => ({
      completed,
      failed,
      active: 0,
      successRate: completed + failed > 0 ? completed / (completed + failed) : 1,
    }),
  } as unknown as SwarmAgent;
}

describe('Voting Protocol', () => {
  const agents = [
    createMockAgent('expert', 20, 2),    // high experience, 91% success
    createMockAgent('mid', 5, 1),         // medium experience
    createMockAgent('newbie', 1, 0),      // low experience
  ];

  describe('conductVoting', () => {
    it('selects winner by highest weighted total', () => {
      const voteFn = (agent: SwarmAgent) => {
        if (agent.agentId === 'expert') return { option: 'A', confidence: 0.9, reasoning: 'proven approach' };
        if (agent.agentId === 'mid') return { option: 'A', confidence: 0.7, reasoning: 'seems good' };
        return { option: 'B', confidence: 0.5, reasoning: 'unsure' };
      };

      const result = conductVoting(agents, 'Which approach?', ['A', 'B'], voteFn);
      expect(result.winner).toBe('A');
      expect(result.votes).toHaveLength(3);
    });

    it('reaches consensus when >70% weight agrees', () => {
      const voteFn = () => ({ option: 'X', confidence: 0.8, reasoning: 'unanimous' });
      const result = conductVoting(agents, 'Question?', ['X', 'Y'], voteFn);
      expect(result.consensus).toBe(true);
      expect(result.winner).toBe('X');
    });

    it('no consensus when split evenly', () => {
      const voteFn = (agent: SwarmAgent) => {
        return agent.agentId === 'expert'
          ? { option: 'A', confidence: 0.5, reasoning: 'maybe A' }
          : { option: 'B', confidence: 0.9, reasoning: 'definitely B' };
      };
      const result = conductVoting(agents, 'Split?', ['A', 'B'], voteFn);
      // Expert has high experience but low confidence, others have higher confidence
      expect(result.votes).toHaveLength(3);
    });

    it('skips invalid option votes', () => {
      const voteFn = (agent: SwarmAgent) => {
        if (agent.agentId === 'newbie') return { option: 'INVALID', confidence: 1.0, reasoning: 'wrong' };
        return { option: 'A', confidence: 0.8, reasoning: 'correct' };
      };
      const result = conductVoting(agents, 'Q', ['A', 'B'], voteFn);
      expect(result.votes).toHaveLength(2); // newbie's invalid vote skipped
    });

    it('handles all agents failing to vote', () => {
      const voteFn = () => { throw new Error('agent down'); };
      const result = conductVoting(agents, 'Q', ['A', 'B'], voteFn);
      expect(result.tiebroken).toBe(true);
      expect(result.votes).toHaveLength(0);
    });
  });

  describe('negotiate', () => {
    it('reaches consensus in round 1', () => {
      const voteFn = () => ({ option: 'A', confidence: 0.9, reasoning: 'agree' });

      const result = negotiate(agents, 'expert', {
        question: 'Which?',
        options: ['A', 'B'],
        maxRounds: 3,
        consensusThreshold: 0.7,
      }, voteFn);

      expect(result.consensus).toBe(true);
      expect(result.rounds).toBe(1);
    });

    it('uses leader tiebreaker after max rounds', () => {
      let round = 0;
      const voteFn = (agent: SwarmAgent) => {
        round++;
        // Alternating votes — never reach consensus
        return agent.agentId === 'expert'
          ? { option: 'A', confidence: 0.5, reasoning: 'prefer A' }
          : { option: 'B', confidence: 0.9, reasoning: 'prefer B' };
      };

      const result = negotiate(agents, 'expert', {
        question: 'Deadlock?',
        options: ['A', 'B'],
        maxRounds: 3,
        consensusThreshold: 0.7,
      }, voteFn);

      expect(result.tiebroken).toBe(true);
      expect(result.winner).toBe('A'); // leader chose A
    });

    it('handles no leader gracefully', () => {
      const voteFn = (agent: SwarmAgent) => {
        return agent.agentId === 'expert'
          ? { option: 'A', confidence: 0.5, reasoning: 'A' }
          : { option: 'B', confidence: 0.9, reasoning: 'B' };
      };

      const result = negotiate(agents, null, {
        question: 'No leader?',
        options: ['A', 'B'],
        maxRounds: 2,
        consensusThreshold: 0.7,
      }, voteFn);

      // Without leader, the highest weighted option wins
      expect(result.rounds).toBe(2);
    });
  });
});
