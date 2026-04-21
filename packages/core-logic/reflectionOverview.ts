import type { NightlyCycleResult, PainPoint, ReflectionStats } from './reflectionEngine.js';
import type { MetaInsight } from './metaReasoner.js';
import type { SelfModelState } from './selfModel.js';

export interface ReflectionMemoryScope {
  purpose: string;
  sources: string[];
}

export interface ReflectionOverviewSelfModel extends SelfModelState {
  memoryScopes: {
    global: ReflectionMemoryScope;
    local: ReflectionMemoryScope;
  };
}

export interface ReflectionOverview {
  stats: ReflectionStats;
  selfModel: ReflectionOverviewSelfModel;
  painPoints: PainPoint[];
  insights: MetaInsight[];
  context: string;
}

export type ReflectionNightlyCycleResult = NightlyCycleResult;
