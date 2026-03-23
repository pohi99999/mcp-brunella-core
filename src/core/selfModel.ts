/**
 * SelfModel — Reflective model of Brunella's capabilities, blind spots, and constraints
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { EventEmitter } from 'events';
import { logInfo } from '../utils/logger.js';

export interface SelfModelSignal {
  signalId: string;
  source: string;
  category: 'performance' | 'behavior' | 'capability' | 'risk' | 'goal';
  confidence: number;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface CapabilityBelief {
  capability: string;
  confidence: number;
  evidence: number;
  state: 'emerging' | 'confident' | 'uncertain';
}

export interface BlindSpot {
  area: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface SelfModelState {
  identity: string;
  coherence: number;
  health: 'coherent' | 'learning' | 'drifting';
  capabilities: CapabilityBelief[];
  blindSpots: BlindSpot[];
  constraints: string[];
  lastReflectionAt?: number;
}

export class SelfModel extends EventEmitter {
  private readonly identity: string;
  private readonly signals: SelfModelSignal[] = [];
  private readonly constraints = new Set<string>();
  private state: SelfModelState;

  constructor(identity = 'Brunella HyperKernel') {
    super();
    this.identity = identity;
    this.state = {
      identity,
      coherence: 0.75,
      health: 'learning',
      capabilities: [],
      blindSpots: [],
      constraints: [],
    };
  }

  setConstraint(constraint: string): void {
    this.constraints.add(constraint);
    this.state.constraints = Array.from(this.constraints.values());
  }

  ingestSignal(signal: Omit<SelfModelSignal, 'signalId' | 'timestamp'> & Partial<Pick<SelfModelSignal, 'signalId' | 'timestamp'>>): SelfModelSignal {
    const full: SelfModelSignal = {
      ...signal,
      signalId: signal.signalId ?? `sms-${this.signals.length + 1}-${Date.now()}`,
      timestamp: signal.timestamp ?? Date.now(),
      confidence: Math.max(0, Math.min(1, signal.confidence)),
    };

    this.signals.push(full);
    if (this.signals.length > 250) {
      this.signals.splice(0, this.signals.length - 250);
    }

    this.emit('signal', full);
    return full;
  }

  reflect(windowSize = 50): SelfModelState {
    const recent = this.signals.slice(-windowSize);
    const capabilityScores = new Map<string, { total: number; evidence: number }>();
    const blindSpots: BlindSpot[] = [];

    for (const signal of recent) {
      const capability = typeof signal.payload.capability === 'string'
        ? signal.payload.capability
        : typeof signal.payload.area === 'string'
          ? signal.payload.area
          : signal.category;

      const entry = capabilityScores.get(capability) ?? { total: 0, evidence: 0 };
      entry.total += signal.confidence;
      entry.evidence += 1;
      capabilityScores.set(capability, entry);

      if (signal.category === 'risk' || signal.category === 'performance') {
        const severityValue = typeof signal.payload.severity === 'string' ? signal.payload.severity : undefined;
        const severity = severityValue === 'high' || severityValue === 'medium' || severityValue === 'low'
          ? severityValue
          : signal.confidence > 0.8
            ? 'high'
            : signal.confidence > 0.5
              ? 'medium'
              : 'low';

        if (signal.confidence >= 0.55) {
          blindSpots.push({
            area: capability,
            severity,
            description: typeof signal.payload.description === 'string'
              ? signal.payload.description
              : `Observed weakness in ${capability}`,
          });
        }
      }
    }

    const capabilities: CapabilityBelief[] = Array.from(capabilityScores.entries()).map(([capability, score]): CapabilityBelief => {
      const confidence = score.evidence === 0 ? 0 : score.total / score.evidence;
      const state: CapabilityBelief['state'] = confidence > 0.75
        ? 'confident'
        : confidence > 0.45
          ? 'emerging'
          : 'uncertain';

      return {
        capability,
        confidence,
        evidence: score.evidence,
        state,
      };
    }).sort((a, b) => b.confidence - a.confidence);

    const coherence = recent.length === 0
      ? this.state.coherence
      : Math.max(0.2, Math.min(1, 1 - blindSpots.length * 0.08 + capabilities.length * 0.03));

    const health: SelfModelState['health'] = coherence > 0.8
      ? 'coherent'
      : coherence > 0.55
        ? 'learning'
        : 'drifting';

    this.state = {
      identity: this.identity,
      coherence,
      health,
      capabilities,
      blindSpots: this.uniqueBlindSpots(blindSpots),
      constraints: Array.from(this.constraints.values()),
      lastReflectionAt: Date.now(),
    };

    this.emit('reflection', this.state);
    logInfo('SelfModel', `Reflection complete: ${capabilities.length} capabilities, ${this.state.blindSpots.length} blind spots, health=${health}`);
    return this.getState();
  }

  getSignals(limit = 20): SelfModelSignal[] {
    return this.signals.slice(-limit);
  }

  getState(): SelfModelState {
    return {
      ...this.state,
      capabilities: this.state.capabilities.map(item => ({ ...item })),
      blindSpots: this.state.blindSpots.map(item => ({ ...item })),
      constraints: [...this.state.constraints],
    };
  }

  private uniqueBlindSpots(blindSpots: BlindSpot[]): BlindSpot[] {
    const seen = new Set<string>();
    const values: BlindSpot[] = [];
    for (const blindSpot of blindSpots) {
      const key = `${blindSpot.area}:${blindSpot.description}`;
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(blindSpot);
    }
    return values;
  }
}
