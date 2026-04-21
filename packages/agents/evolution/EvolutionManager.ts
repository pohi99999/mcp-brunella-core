/**
 * EvolutionManager — Population-based agent evolution
 * Phase 6: Evolutionary Collective Intelligence
 *
 * Manages populations of genome variants, runs tournaments,
 * selects the fittest, and evolves agents over generations.
 */

import { EventEmitter } from 'events';
import { logInfo } from '../../utils/logger.js';
import { EvolutionaryAgent, type AgentGenome, type MutationType } from './EvolutionaryAgent.js';

export interface EvolutionConfig {
  populationSize: number;
  mutationRate: number;       // 0–1, probability of mutation per genome
  eliteRatio: number;         // fraction of top genomes to keep
  maxGenerations: number;
  fitnessThreshold: number;   // stop when best fitness exceeds this
}

export interface GenerationResult {
  generation: number;
  populationSize: number;
  bestFitness: number;
  avgFitness: number;
  bestGenomeId: string;
  timestamp: number;
}

const DEFAULT_CONFIG: EvolutionConfig = {
  populationSize: 10,
  mutationRate: 0.3,
  eliteRatio: 0.2,
  maxGenerations: 50,
  fitnessThreshold: 0.95,
};

export class EvolutionManager extends EventEmitter {
  private evoAgent: EvolutionaryAgent;
  private config: EvolutionConfig;
  private generations: GenerationResult[] = [];

  constructor(evoAgent: EvolutionaryAgent, config?: Partial<EvolutionConfig>) {
    super();
    this.evoAgent = evoAgent;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Initialize a population for an agent */
  initPopulation(agentId: string, basePrompt: string, tools: string[], params?: Record<string, number>): AgentGenome[] {
    const population: AgentGenome[] = [];

    // Create base genome
    const base = this.evoAgent.createGenome({ agentId, systemPrompt: basePrompt, tools, parameters: params });
    population.push(base);

    // Create variants via mutation
    const mutations: MutationType[] = ['prompt_tweak', 'tool_add', 'param_adjust'];
    for (let i = 1; i < this.config.populationSize; i++) {
      const parentId = population[Math.floor(Math.random() * population.length)].id;
      const mutationType = mutations[i % mutations.length];
      const result = this.evoAgent.mutate(parentId, mutationType);
      if (result) population.push(result.mutated);
    }

    logInfo('EvolutionManager', `Population initialized for ${agentId}: ${population.length} genomes`);
    return population;
  }

  /** Run selection: keep top genomes, produce next generation */
  evolveGeneration(agentId: string): GenerationResult {
    const genomes = this.evoAgent.getGenomesForAgent(agentId); // sorted by fitness desc
    if (genomes.length === 0) throw new Error(`No genomes for agent ${agentId}`);

    const eliteCount = Math.max(1, Math.ceil(genomes.length * this.config.eliteRatio));
    const elites = genomes.slice(0, eliteCount);
    const mutations: MutationType[] = ['prompt_tweak', 'tool_add', 'tool_remove', 'param_adjust'];

    // Produce new genomes
    const targetSize = this.config.populationSize;
    let newCount = elites.length;

    // Crossover
    while (newCount < targetSize * 0.6 && elites.length >= 2) {
      const a = elites[Math.floor(Math.random() * elites.length)].id;
      const b = elites[Math.floor(Math.random() * elites.length)].id;
      if (a !== b) {
        this.evoAgent.crossover(a, b);
        newCount++;
      }
    }

    // Mutation of elites
    while (newCount < targetSize) {
      const parent = elites[Math.floor(Math.random() * elites.length)];
      if (Math.random() < this.config.mutationRate) {
        const mt = mutations[Math.floor(Math.random() * mutations.length)];
        this.evoAgent.mutate(parent.id, mt);
      }
      newCount++;
    }

    const allGenomes = this.evoAgent.getGenomesForAgent(agentId);
    const bestGenome = allGenomes[0];
    const totalFitness = allGenomes.reduce((s, g) => s + g.fitness, 0);

    const result: GenerationResult = {
      generation: this.generations.length + 1,
      populationSize: allGenomes.length,
      bestFitness: bestGenome?.fitness ?? 0,
      avgFitness: allGenomes.length > 0 ? totalFitness / allGenomes.length : 0,
      bestGenomeId: bestGenome?.id ?? '',
      timestamp: Date.now(),
    };

    this.generations.push(result);
    this.emit('generation:complete', result);
    logInfo('EvolutionManager', `Gen ${result.generation}: best=${result.bestFitness.toFixed(3)}, avg=${result.avgFitness.toFixed(3)}`);
    return result;
  }

  /** Set fitness for a genome (delegates to EvolutionaryAgent) */
  setFitness(genomeId: string, fitness: number): void {
    this.evoAgent.setFitness(genomeId, fitness);
  }

  /** Get generation history */
  getHistory(): GenerationResult[] {
    return [...this.generations];
  }

  /** Get current best genome for an agent */
  getBest(agentId: string): AgentGenome | undefined {
    return this.evoAgent.getBest(agentId);
  }

  /** Check if evolution should stop */
  shouldStop(agentId: string): boolean {
    const best = this.evoAgent.getBest(agentId);
    if (!best) return false;
    if (best.fitness >= this.config.fitnessThreshold) return true;
    if (this.generations.length >= this.config.maxGenerations) return true;
    return false;
  }
}
