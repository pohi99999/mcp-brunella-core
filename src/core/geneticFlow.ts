/**
 * GeneticFlow — Genetic-algorithm-based workflow optimization
 * Phase 6: Evolutionary Collective Intelligence
 *
 * Evaluates multiple workflow variants (mutation / crossover of step order,
 * handler selection, parameter ranges), runs them against metrics, and
 * selects the fittest variant as the new default.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '../utils/logger.js';

export interface FlowVariant {
  id: string;
  flowId: string;
  generation: number;
  stepOrder: string[];             // ordered step IDs
  parameterOverrides: Record<string, number>;
  fitness: number;                 // 0–1 measured quality
  parentIds: string[];
  mutations: string[];
  createdAt: number;
}

export interface GeneticFlowConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  maxGenerations: number;
  fitnessGoal: number;
}

export interface VariantEvaluation {
  variantId: string;
  durationMs: number;
  successRate: number;
  outputQuality: number;          // 0–1
  fitness: number;                // computed composite
}

const DEFAULT_CONFIG: GeneticFlowConfig = {
  populationSize: 8,
  mutationRate: 0.25,
  crossoverRate: 0.4,
  maxGenerations: 30,
  fitnessGoal: 0.9,
};

export class GeneticFlow extends EventEmitter {
  private config: GeneticFlowConfig;
  private variants = new Map<string, FlowVariant>();
  private evaluations: VariantEvaluation[] = [];
  private variantCounter = 0;

  constructor(config?: Partial<GeneticFlowConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Seed an initial population from a base flow definition */
  seedPopulation(flowId: string, baseStepOrder: string[], baseParams: Record<string, number> = {}): FlowVariant[] {
    const population: FlowVariant[] = [];

    const base = this.createVariant(flowId, baseStepOrder, baseParams, 0, [], ['seed']);
    population.push(base);

    for (let i = 1; i < this.config.populationSize; i++) {
      const parent = population[Math.floor(Math.random() * population.length)];
      const mutated = this.mutateVariant(parent);
      population.push(mutated);
    }

    logInfo('GeneticFlow', `Population seeded for ${flowId}: ${population.length} variants`);
    return population;
  }

  /** Record evaluation results for a variant */
  evaluate(variantId: string, result: Omit<VariantEvaluation, 'variantId' | 'fitness'>): VariantEvaluation {
    const fitness = result.successRate * 0.5 + result.outputQuality * 0.3 + Math.max(0, 1 - result.durationMs / 10000) * 0.2;
    const evaluation: VariantEvaluation = { variantId, ...result, fitness };
    this.evaluations.push(evaluation);

    const variant = this.variants.get(variantId);
    if (variant) variant.fitness = fitness;

    this.emit('variant:evaluated', evaluation);
    return evaluation;
  }

  /** Evolve the next generation: select top, crossover, mutate */
  evolve(flowId: string): FlowVariant[] {
    const all = this.getVariantsForFlow(flowId);
    if (all.length === 0) return [];

    const sorted = [...all].sort((a, b) => b.fitness - a.fitness);
    const eliteCount = Math.max(1, Math.ceil(sorted.length * 0.3));
    const elites = sorted.slice(0, eliteCount);
    const nextGen: FlowVariant[] = [...elites];

    // Crossover
    while (nextGen.length < this.config.populationSize * 0.6 && elites.length >= 2) {
      const a = elites[Math.floor(Math.random() * elites.length)];
      const b = elites[Math.floor(Math.random() * elites.length)];
      if (a.id !== b.id) {
        const child = this.crossoverVariants(a, b);
        nextGen.push(child);
      }
    }

    // Mutate to fill population
    while (nextGen.length < this.config.populationSize) {
      const parent = elites[Math.floor(Math.random() * elites.length)];
      if (Math.random() < this.config.mutationRate) {
        nextGen.push(this.mutateVariant(parent));
      } else {
        nextGen.push(this.createVariant(
          parent.flowId,
          [...parent.stepOrder],
          { ...parent.parameterOverrides },
          parent.generation + 1,
          [parent.id],
          ['clone']
        ));
      }
    }

    logInfo('GeneticFlow', `Evolved generation for ${flowId}: ${nextGen.length} variants, best fitness=${sorted[0].fitness.toFixed(3)}`);
    this.emit('generation:evolved', { flowId, size: nextGen.length, bestFitness: sorted[0].fitness });
    return nextGen;
  }

  /** Get the best variant for a flow */
  getBest(flowId: string): FlowVariant | undefined {
    return this.getVariantsForFlow(flowId).sort((a, b) => b.fitness - a.fitness)[0];
  }

  /** Get all variants for a flow */
  getVariantsForFlow(flowId: string): FlowVariant[] {
    return Array.from(this.variants.values()).filter(v => v.flowId === flowId);
  }

  /** Check if goal reached */
  goalReached(flowId: string): boolean {
    const best = this.getBest(flowId);
    return !!best && best.fitness >= this.config.fitnessGoal;
  }

  /** Get evaluation history */
  getEvaluations(): VariantEvaluation[] {
    return [...this.evaluations];
  }

  /** Create a variant */
  private createVariant(
    flowId: string, stepOrder: string[], params: Record<string, number>,
    generation: number, parentIds: string[], mutations: string[]
  ): FlowVariant {
    const variant: FlowVariant = {
      id: `fv-${++this.variantCounter}-${Date.now()}`,
      flowId,
      generation,
      stepOrder: [...stepOrder],
      parameterOverrides: { ...params },
      fitness: 0,
      parentIds,
      mutations,
      createdAt: Date.now(),
    };
    this.variants.set(variant.id, variant);
    return variant;
  }

  /** Mutate a variant: shuffle steps or tweak params */
  private mutateVariant(parent: FlowVariant): FlowVariant {
    const newSteps = [...parent.stepOrder];
    const newParams = { ...parent.parameterOverrides };
    const mutationTypes: string[] = [];

    // Random swap of two steps
    if (newSteps.length >= 2 && Math.random() < 0.5) {
      const i = Math.floor(Math.random() * newSteps.length);
      const j = Math.floor(Math.random() * newSteps.length);
      [newSteps[i], newSteps[j]] = [newSteps[j], newSteps[i]];
      mutationTypes.push('step_swap');
    }

    // Param tweak
    const paramKeys = Object.keys(newParams);
    if (paramKeys.length > 0 && Math.random() < 0.5) {
      const key = paramKeys[Math.floor(Math.random() * paramKeys.length)];
      newParams[key] = Math.max(0, Math.min(1, (newParams[key] ?? 0.5) + (Math.random() - 0.5) * 0.3));
      mutationTypes.push('param_tweak');
    }

    if (mutationTypes.length === 0) mutationTypes.push('clone');

    return this.createVariant(
      parent.flowId, newSteps, newParams,
      parent.generation + 1, [parent.id], mutationTypes
    );
  }

  /** Crossover two variants */
  private crossoverVariants(a: FlowVariant, b: FlowVariant): FlowVariant {
    const mid = Math.ceil(a.stepOrder.length / 2);
    const childSteps = [...new Set([...a.stepOrder.slice(0, mid), ...b.stepOrder.slice(mid)])];

    const childParams: Record<string, number> = {};
    const allKeys = new Set([...Object.keys(a.parameterOverrides), ...Object.keys(b.parameterOverrides)]);
    for (const key of allKeys) {
      childParams[key] = ((a.parameterOverrides[key] ?? 0.5) + (b.parameterOverrides[key] ?? 0.5)) / 2;
    }

    return this.createVariant(
      a.flowId, childSteps, childParams,
      Math.max(a.generation, b.generation) + 1,
      [a.id, b.id], ['crossover']
    );
  }
}
