/**
 * GoalEngine — Autonomous goal creation and evaluation
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { EventEmitter } from 'events';
import { logInfo } from '@packages/utils/logger.js';
import type { ForecastResult } from './globalOptimizer.js';
import type { SelfModelState } from './selfModel.js';

export interface AutonomousGoal {
  goalId: string;
  title: string;
  category: 'resilience' | 'efficiency' | 'autonomy' | 'alignment' | 'growth';
  metric: string;
  direction: 'increase' | 'decrease';
  targetValue: number;
  currentValue: number;
  priority: number;
  rationale: string;
  status: 'proposed' | 'active' | 'blocked' | 'completed' | 'abandoned';
  createdAt: number;
}

export interface GoalDecision {
  decisionId: string;
  goalId: string;
  type: 'created' | 'activated' | 'completed' | 'blocked' | 'abandoned';
  reason: string;
  timestamp: number;
}

export class GoalEngine extends EventEmitter {
  private readonly goals = new Map<string, AutonomousGoal>();
  private readonly decisions: GoalDecision[] = [];
  private goalCounter = 0;
  private decisionCounter = 0;

  createGoal(goal: Omit<AutonomousGoal, 'goalId' | 'createdAt' | 'status'> & Partial<Pick<AutonomousGoal, 'status'>>): AutonomousGoal {
    const full: AutonomousGoal = {
      ...goal,
      goalId: `goal-${++this.goalCounter}-${Date.now()}`,
      createdAt: Date.now(),
      status: goal.status ?? 'active',
    };
    this.goals.set(full.goalId, full);
    this.recordDecision(full.goalId, 'created', full.rationale);
    this.emit('goal:created', full);
    return full;
  }

  synthesizeGoals(selfModel: SelfModelState, forecast?: ForecastResult): AutonomousGoal[] {
    const created: AutonomousGoal[] = [];

    for (const blindSpot of selfModel.blindSpots) {
      if (blindSpot.severity === 'high' && !this.hasOpenGoal(blindSpot.area)) {
        created.push(this.createGoal({
          title: `Stabilize ${blindSpot.area}`,
          category: 'resilience',
          metric: blindSpot.area,
          direction: 'increase',
          targetValue: 0.8,
          currentValue: 0.45,
          priority: 85,
          rationale: blindSpot.description,
        }));
      }
    }

    if (forecast && forecast.autonomyScore < 0.75 && !this.hasOpenGoal('autonomy-score')) {
      created.push(this.createGoal({
        title: 'Increase autonomy score',
        category: 'autonomy',
        metric: 'autonomy-score',
        direction: 'increase',
        targetValue: 0.82,
        currentValue: forecast.autonomyScore,
        priority: 80,
        rationale: `Autonomy score is ${forecast.autonomyScore.toFixed(2)} and needs reinforcement`,
      }));
    }

    if (forecast && forecast.costPerHour > 4 && !this.hasOpenGoal('cost-per-hour')) {
      created.push(this.createGoal({
        title: 'Reduce hourly infrastructure cost',
        category: 'efficiency',
        metric: 'cost-per-hour',
        direction: 'decrease',
        targetValue: 3.5,
        currentValue: forecast.costPerHour,
        priority: 70,
        rationale: `Cost footprint is ${forecast.costPerHour.toFixed(2)}/h`,
      }));
    }

    return created;
  }

  updateProgress(goalId: string, currentValue: number): AutonomousGoal | null {
    const goal = this.goals.get(goalId);
    if (!goal) return null;
    goal.currentValue = currentValue;
    this.emit('goal:progress', goal);
    return goal;
  }

  setGoalStatus(
    goalId: string,
    status: Exclude<AutonomousGoal['status'], 'proposed'>,
    reason: string,
  ): AutonomousGoal | null {
    const goal = this.goals.get(goalId);
    if (!goal) return null;

    goal.status = status;

    if (status === 'active') {
      this.recordDecision(goal.goalId, 'activated', reason);
    } else if (status === 'completed') {
      this.recordDecision(goal.goalId, 'completed', reason);
    } else if (status === 'blocked') {
      this.recordDecision(goal.goalId, 'blocked', reason);
    } else if (status === 'abandoned') {
      this.recordDecision(goal.goalId, 'abandoned', reason);
    }

    this.emit('goal:decision', { goalId: goal.goalId, status, reason });
    return goal;
  }

  evaluateGoals(): GoalDecision[] {
    const decisions: GoalDecision[] = [];
    for (const goal of this.goals.values()) {
      if (goal.status === 'completed' || goal.status === 'abandoned') continue;

      const completed = goal.direction === 'increase'
        ? goal.currentValue >= goal.targetValue
        : goal.currentValue <= goal.targetValue;

      if (completed) {
        goal.status = 'completed';
        decisions.push(this.recordDecision(goal.goalId, 'completed', `Metric ${goal.metric} reached target`));
        continue;
      }

      if (goal.status === 'proposed') {
        goal.status = 'active';
        decisions.push(this.recordDecision(goal.goalId, 'activated', 'Goal promoted to active evaluation'));
      }
    }

    logInfo('GoalEngine', `Evaluated ${this.goals.size} goals, ${decisions.length} state changes`);
    return decisions;
  }

  getGoals(status?: AutonomousGoal['status']): AutonomousGoal[] {
    const values = Array.from(this.goals.values());
    return status ? values.filter(goal => goal.status === status) : values;
  }

  getDecisions(): GoalDecision[] {
    return [...this.decisions];
  }

  getStats(): { goals: number; active: number; completed: number; decisions: number } {
    return {
      goals: this.goals.size,
      active: this.getGoals().filter(goal => goal.status === 'active').length,
      completed: this.getGoals('completed').length,
      decisions: this.decisions.length,
    };
  }

  private hasOpenGoal(metric: string): boolean {
    return this.getGoals().some(goal => goal.metric === metric && !['completed', 'abandoned'].includes(goal.status));
  }

  private recordDecision(goalId: string, type: GoalDecision['type'], reason: string): GoalDecision {
    const decision: GoalDecision = {
      decisionId: `gd-${++this.decisionCounter}-${Date.now()}`,
      goalId,
      type,
      reason,
      timestamp: Date.now(),
    };
    this.decisions.push(decision);
    this.emit('goal:decision', decision);
    return decision;
  }
}

