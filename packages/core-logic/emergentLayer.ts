/**
 * src/core/emergentLayer.ts
 *
 * Az ágensek közötti interakciókból fakadó kollektív intelligencia réteg.
 * Az Emergent Layer új mintázatokat észlel és oszt meg a hálózattal, 
 * valamint tárolja az aggregált tudást a meta-evolúciós ágens számára.
 */

import { logInfo, logError } from '@packages/utils/logger.js';

export interface InteractionPattern {
  id: string;
  sourceAgentType: string;
  targetAgentType: string;
  frequency: number;
  successRate: number;
  lastObserved: string;
}

export class EmergentLayer {
  private patterns: Map<string, InteractionPattern> = new Map();
  private observationCount: number = 0;

  constructor() {
    logInfo('EmergentLayer initialized');
  }

  public recordInteraction(sourceType: string, targetType: string, success: boolean): void {
    const patternId = `${sourceType}->${targetType}`;
    let pattern = this.patterns.get(patternId);

    if (!pattern) {
      pattern = {
        id: patternId,
        sourceAgentType: sourceType,
        targetAgentType: targetType,
        frequency: 0,
        successRate: 1.0,
        lastObserved: new Date().toISOString(),
      };
    }

    pattern.frequency += 1;
    // Mozgó átlag számítása a sikerességi rátára
    pattern.successRate = pattern.successRate * 0.9 + (success ? 1 : 0) * 0.1;
    pattern.lastObserved = new Date().toISOString();

    this.patterns.set(patternId, pattern);
    this.observationCount += 1;
  }

  public getEmergentPatterns(minFrequency: number = 5): InteractionPattern[] {
    return Array.from(this.patterns.values()).filter(p => p.frequency >= minFrequency);
  }

  public getGlobalCohesionScore(): number {
    if (this.patterns.size === 0) return 0;
    
    let totalSuccess = 0;
    const values = Array.from(this.patterns.values());
    for (const pattern of values) {
      totalSuccess += pattern.successRate;
    }
    return totalSuccess / this.patterns.size;
  }

  public resetObservations(): void {
    this.patterns.clear();
    this.observationCount = 0;
  }
}

