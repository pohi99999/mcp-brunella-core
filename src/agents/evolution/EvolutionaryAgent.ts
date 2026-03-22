/**
 * EvolutionaryAgent — Sandboxed agent mutation and evolution
 * Phase 6: Evolutionary Collective Intelligence
 *
 * Wraps agents with evolutionary capabilities: prompt mutation,
 * tool variation, parameter tuning — all in a safe sandbox.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '../../utils/logger.js';

export interface AgentGenome {
  id: string;
  agentId: string;
  generation: number;
  systemPrompt: string;
  tools: string[];
  parameters: Record<string, number>;
  fitness: number;          // 0–1 measured performance
  parentId?: string;
  mutationLog: string[];
  createdAt: number;
}

export type MutationType = 'prompt_tweak' | 'tool_add' | 'tool_remove' | 'param_adjust' | 'crossover';

export interface MutationResult {
  original: AgentGenome;
  mutated: AgentGenome;
  mutationType: MutationType;
  description: string;
}

export class EvolutionaryAgent extends EventEmitter {
  private genomes = new Map<string, AgentGenome>();
  private genomeCounter = 0;

  /** Create an initial genome for an agent */
  createGenome(config: {
    agentId: string;
    systemPrompt: string;
    tools: string[];
    parameters?: Record<string, number>;
  }): AgentGenome {
    const genome: AgentGenome = {
      id: `genome-${++this.genomeCounter}-${Date.now()}`,
      agentId: config.agentId,
      generation: 0,
      systemPrompt: config.systemPrompt,
      tools: [...config.tools],
      parameters: { ...config.parameters },
      fitness: 0,
      mutationLog: ['initial'],
      createdAt: Date.now(),
    };

    this.genomes.set(genome.id, genome);
    this.emit('genome:created', genome);
    return genome;
  }

  /** Mutate a genome to produce a variant */
  mutate(genomeId: string, mutationType: MutationType): MutationResult | null {
    const original = this.genomes.get(genomeId);
    if (!original) return null;

    const mutated: AgentGenome = {
      ...original,
      id: `genome-${++this.genomeCounter}-${Date.now()}`,
      generation: original.generation + 1,
      parentId: original.id,
      fitness: 0,
      mutationLog: [...original.mutationLog, mutationType],
      tools: [...original.tools],
      parameters: { ...original.parameters },
      createdAt: Date.now(),
    };

    let description = '';
    switch (mutationType) {
      case 'prompt_tweak':
        mutated.systemPrompt = this.tweakPrompt(original.systemPrompt);
        description = 'System prompt variation applied';
        break;
      case 'tool_add':
        mutated.tools.push(`tool_${Date.now()}`);
        description = `Added new tool (${mutated.tools.length} total)`;
        break;
      case 'tool_remove':
        if (mutated.tools.length > 1) {
          const removed = mutated.tools.pop();
          description = `Removed tool ${removed}`;
        } else {
          description = 'No tools to remove (kept minimum)';
        }
        break;
      case 'param_adjust': {
        const keys = Object.keys(mutated.parameters);
        if (keys.length > 0) {
          const key = keys[Math.floor(Math.random() * keys.length)];
          const delta = (Math.random() - 0.5) * 0.2;
          mutated.parameters[key] = Math.max(0, Math.min(1, (mutated.parameters[key] ?? 0.5) + delta));
          description = `Adjusted ${key} by ${delta.toFixed(3)}`;
        } else {
          description = 'No parameters to adjust';
        }
        break;
      }
      case 'crossover':
        description = 'Crossover (requires two parents — single-parent fallback)';
        break;
    }

    this.genomes.set(mutated.id, mutated);
    logInfo('EvolutionaryAgent', `Mutation: ${mutationType} on ${genomeId} → ${mutated.id}`);

    const result: MutationResult = { original, mutated, mutationType, description };
    this.emit('genome:mutated', result);
    return result;
  }

  /** Crossover two genomes */
  crossover(parentA: string, parentB: string): AgentGenome | null {
    const a = this.genomes.get(parentA);
    const b = this.genomes.get(parentB);
    if (!a || !b) return null;

    const child: AgentGenome = {
      id: `genome-${++this.genomeCounter}-${Date.now()}`,
      agentId: a.agentId,
      generation: Math.max(a.generation, b.generation) + 1,
      systemPrompt: Math.random() > 0.5 ? a.systemPrompt : b.systemPrompt,
      tools: [...new Set([...a.tools.slice(0, Math.ceil(a.tools.length / 2)), ...b.tools.slice(Math.ceil(b.tools.length / 2))])],
      parameters: this.mergeParameters(a.parameters, b.parameters),
      fitness: 0,
      parentId: a.id,
      mutationLog: [...a.mutationLog, `crossover_with_${b.id}`],
      createdAt: Date.now(),
    };

    this.genomes.set(child.id, child);
    this.emit('genome:crossover', child);
    return child;
  }

  /** Set fitness score after evaluation */
  setFitness(genomeId: string, fitness: number): void {
    const genome = this.genomes.get(genomeId);
    if (genome) {
      genome.fitness = Math.max(0, Math.min(1, fitness));
    }
  }

  /** Get a genome */
  getGenome(id: string): AgentGenome | undefined {
    return this.genomes.get(id);
  }

  /** Get all genomes for an agent, sorted by fitness */
  getGenomesForAgent(agentId: string): AgentGenome[] {
    return Array.from(this.genomes.values())
      .filter(g => g.agentId === agentId)
      .sort((a, b) => b.fitness - a.fitness);
  }

  /** Get the best genome for an agent */
  getBest(agentId: string): AgentGenome | undefined {
    return this.getGenomesForAgent(agentId)[0];
  }

  /** Simple prompt tweak: add variation markers */
  private tweakPrompt(prompt: string): string {
    const tweaks = [
      'Be more concise.',
      'Provide step-by-step reasoning.',
      'Focus on accuracy over speed.',
      'Use structured output format.',
      'Prioritize user intent detection.',
    ];
    const tweak = tweaks[Math.floor(Math.random() * tweaks.length)];
    return prompt + ` [Evolved: ${tweak}]`;
  }

  /** Merge parameters from two parents (average) */
  private mergeParameters(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const merged: Record<string, number> = {};
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      merged[key] = ((a[key] ?? 0.5) + (b[key] ?? 0.5)) / 2;
    }
    return merged;
  }
}
