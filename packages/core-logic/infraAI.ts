/**
 * InfraAI — Autonomous infrastructure analysis and recovery recommendations
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { EventEmitter } from 'events';
import { logInfo } from '@packages/utils/logger.js';

export interface InfraResource {
  resourceId: string;
  kind: 'compute' | 'storage' | 'network' | 'queue' | 'model';
  region: string;
  utilization: number;
  costPerHour: number;
  health: 'healthy' | 'degraded' | 'failed';
  redundancy: number;
  metadata?: Record<string, unknown>;
}

export interface InfraIncident {
  incidentId: string;
  resourceId: string;
  type: 'latency' | 'outage' | 'capacity' | 'cost_spike' | 'drift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  status: 'open' | 'mitigating' | 'resolved';
  createdAt: number;
  updatedAt: number;
}

export interface InfraRecommendation {
  recommendationId: string;
  type: 'scale_up' | 'scale_down' | 'heal' | 'rebalance' | 'replicate' | 'protect';
  targetResourceId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: {
    latencyDeltaMs: number;
    costDeltaPerHour: number;
    resilienceDelta: number;
  };
  createdAt: number;
}

export interface RecoveryAction {
  actionId: string;
  incidentId: string;
  resourceId: string;
  type: 'restart' | 'failover' | 'throttle' | 'rebalance' | 'replicate';
  status: 'planned' | 'executing' | 'completed';
  createdAt: number;
}

export interface InfraAnalysis {
  resources: InfraResource[];
  incidents: InfraIncident[];
  criticalResources: string[];
  recommendations: InfraRecommendation[];
}

export class InfraAI extends EventEmitter {
  private readonly resources = new Map<string, InfraResource>();
  private readonly incidents = new Map<string, InfraIncident>();
  private readonly recoveryActions: RecoveryAction[] = [];
  private recommendations: InfraRecommendation[] = [];
  private recommendationCounter = 0;
  private actionCounter = 0;

  upsertResource(resource: InfraResource): InfraResource {
    const normalized: InfraResource = {
      ...resource,
      utilization: Math.max(0, Math.min(1, resource.utilization)),
      redundancy: Math.max(0, resource.redundancy),
    };
    this.resources.set(resource.resourceId, normalized);
    this.emit('resource:updated', normalized);
    return normalized;
  }

  reportIncident(incident: Omit<InfraIncident, 'createdAt' | 'updatedAt'>): InfraIncident {
    const now = Date.now();
    const full: InfraIncident = {
      ...incident,
      createdAt: now,
      updatedAt: now,
    };
    this.incidents.set(full.incidentId, full);
    this.emit('incident:reported', full);
    return full;
  }

  resolveIncident(incidentId: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;
    incident.status = 'resolved';
    incident.updatedAt = Date.now();
    this.emit('incident:resolved', incident);
    return true;
  }

  analyze(): InfraAnalysis {
    const resources = Array.from(this.resources.values());
    const incidents = Array.from(this.incidents.values());
    const openIncidents = incidents.filter(incident => incident.status !== 'resolved');
    const nextRecommendations: InfraRecommendation[] = [];

    for (const resource of resources) {
      if (resource.health === 'failed') {
        nextRecommendations.push(this.createRecommendation(
          'heal',
          resource.resourceId,
          `Resource ${resource.resourceId} failed and requires recovery`,
          'critical',
          { latencyDeltaMs: -200, costDeltaPerHour: 0.5, resilienceDelta: 0.3 },
        ));
      } else if (resource.utilization > 0.85) {
        nextRecommendations.push(this.createRecommendation(
          'scale_up',
          resource.resourceId,
          `Resource ${resource.resourceId} is saturated at ${(resource.utilization * 100).toFixed(0)}%`,
          'high',
          { latencyDeltaMs: -120, costDeltaPerHour: 0.8, resilienceDelta: 0.15 },
        ));
      } else if (resource.utilization < 0.2 && resource.costPerHour > 0.4) {
        nextRecommendations.push(this.createRecommendation(
          'scale_down',
          resource.resourceId,
          `Resource ${resource.resourceId} is underutilized relative to its cost`,
          'medium',
          { latencyDeltaMs: 15, costDeltaPerHour: -0.3, resilienceDelta: -0.05 },
        ));
      }

      if (resource.redundancy < 2 && resource.health !== 'healthy') {
        nextRecommendations.push(this.createRecommendation(
          'replicate',
          resource.resourceId,
          `Resource ${resource.resourceId} lacks redundancy while unhealthy`,
          'high',
          { latencyDeltaMs: -30, costDeltaPerHour: 0.4, resilienceDelta: 0.25 },
        ));
      }
    }

    for (const incident of openIncidents) {
      const type = incident.type === 'cost_spike' ? 'protect' : incident.type === 'capacity' ? 'scale_up' : 'rebalance';
      nextRecommendations.push(this.createRecommendation(
        type,
        incident.resourceId,
        incident.summary,
        incident.severity,
        {
          latencyDeltaMs: incident.type === 'latency' ? -80 : -15,
          costDeltaPerHour: incident.type === 'cost_spike' ? -0.4 : 0.2,
          resilienceDelta: incident.severity === 'critical' ? 0.3 : 0.1,
        },
      ));
    }

    this.recommendations = this.dedupeRecommendations(nextRecommendations);

    const criticalResources = resources
      .filter(resource => resource.health === 'failed' || resource.utilization > 0.9)
      .map(resource => resource.resourceId);

    logInfo('InfraAI', `Analysis complete: ${resources.length} resources, ${openIncidents.length} open incidents, ${this.recommendations.length} recommendations`);

    return {
      resources,
      incidents,
      criticalResources,
      recommendations: [...this.recommendations],
    };
  }

  mitigateIncident(incidentId: string): RecoveryAction[] {
    const incident = this.incidents.get(incidentId);
    if (!incident || incident.status === 'resolved') return [];

    incident.status = 'mitigating';
    incident.updatedAt = Date.now();

    const actions: RecoveryAction[] = [];
    const addAction = (type: RecoveryAction['type']) => {
      const action: RecoveryAction = {
        actionId: `ira-${++this.actionCounter}-${Date.now()}`,
        incidentId,
        resourceId: incident.resourceId,
        type,
        status: 'completed',
        createdAt: Date.now(),
      };
      actions.push(action);
      this.recoveryActions.push(action);
    };

    switch (incident.type) {
      case 'outage':
        addAction('failover');
        addAction('restart');
        break;
      case 'capacity':
        addAction('rebalance');
        addAction('replicate');
        break;
      case 'latency':
        addAction('throttle');
        addAction('rebalance');
        break;
      case 'cost_spike':
        addAction('throttle');
        break;
      default:
        addAction('restart');
        break;
    }

    this.emit('incident:mitigated', { incident, actions });
    return actions;
  }

  getResources(): InfraResource[] {
    return Array.from(this.resources.values());
  }

  getIncidents(status?: InfraIncident['status']): InfraIncident[] {
    const values = Array.from(this.incidents.values());
    return status ? values.filter(item => item.status === status) : values;
  }

  getRecommendations(): InfraRecommendation[] {
    return [...this.recommendations];
  }

  getRecoveryActions(): RecoveryAction[] {
    return [...this.recoveryActions];
  }

  getStats(): { resources: number; incidents: number; openIncidents: number; recommendations: number } {
    return {
      resources: this.resources.size,
      incidents: this.incidents.size,
      openIncidents: this.getIncidents().filter(item => item.status !== 'resolved').length,
      recommendations: this.recommendations.length,
    };
  }

  private createRecommendation(
    type: InfraRecommendation['type'],
    targetResourceId: string,
    reason: string,
    priority: InfraRecommendation['priority'],
    impact: InfraRecommendation['impact'],
  ): InfraRecommendation {
    return {
      recommendationId: `ir-${++this.recommendationCounter}-${Date.now()}`,
      type,
      targetResourceId,
      reason,
      priority,
      impact,
      createdAt: Date.now(),
    };
  }

  private dedupeRecommendations(recommendations: InfraRecommendation[]): InfraRecommendation[] {
    const seen = new Set<string>();
    const deduped: InfraRecommendation[] = [];
    for (const recommendation of recommendations) {
      const key = `${recommendation.type}:${recommendation.targetResourceId}:${recommendation.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(recommendation);
    }
    return deduped;
  }
}

