/**
 * EvoEcosystem — System-level evolutionary ecosystem manager
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { EventEmitter } from 'events';
import { logInfo } from '@packages/utils/logger.js';

export interface EcosystemMember {
  agentId: string;
  niche: string;
  generation: number;
  fitness: number;
  energy: number;
  status: 'active' | 'dormant' | 'retired';
  lineage: string[];
  lastEvaluatedAt: number;
}

export interface SelectionDecision {
  decisionId: string;
  cycle: number;
  survivors: string[];
  retired: string[];
  promoted: string[];
  diversityScore: number;
  rationale: string;
  createdAt: number;
}

export class EvoEcosystem extends EventEmitter {
  private readonly members = new Map<string, EcosystemMember>();
  private readonly decisions: SelectionDecision[] = [];
  private cycleCounter = 0;

  registerMember(member: Omit<EcosystemMember, 'lastEvaluatedAt'> & Partial<Pick<EcosystemMember, 'lastEvaluatedAt'>>): EcosystemMember {
    const full: EcosystemMember = {
      ...member,
      fitness: Math.max(0, Math.min(1, member.fitness)),
      energy: Math.max(0, Math.min(1, member.energy)),
      lastEvaluatedAt: member.lastEvaluatedAt ?? Date.now(),
    };
    this.members.set(full.agentId, full);
    this.emit('member:registered', full);
    return full;
  }

  updateMember(agentId: string, patch: Partial<Pick<EcosystemMember, 'fitness' | 'energy' | 'generation' | 'status'>>): EcosystemMember | null {
    const member = this.members.get(agentId);
    if (!member) return null;

    if (typeof patch.fitness === 'number') member.fitness = Math.max(0, Math.min(1, patch.fitness));
    if (typeof patch.energy === 'number') member.energy = Math.max(0, Math.min(1, patch.energy));
    if (typeof patch.generation === 'number') member.generation = patch.generation;
    if (patch.status) member.status = patch.status;
    member.lastEvaluatedAt = Date.now();
    this.emit('member:updated', member);
    return member;
  }

  runSelection(): SelectionDecision {
    const activeMembers = this.getMembers().filter(member => member.status !== 'retired');
    const grouped = new Map<string, EcosystemMember[]>();
    for (const member of activeMembers) {
      const list = grouped.get(member.niche) ?? [];
      list.push(member);
      grouped.set(member.niche, list);
    }

    const survivors = new Set<string>();
    const retired: string[] = [];
    const promoted: string[] = [];

    for (const members of grouped.values()) {
      members.sort((a, b) => (b.fitness + b.energy * 0.2) - (a.fitness + a.energy * 0.2));
      const champion = members[0];
      if (champion) {
        survivors.add(champion.agentId);
        promoted.push(champion.agentId);
      }

      for (const member of members.slice(1)) {
        if (member.fitness < 0.35 || member.energy < 0.2) {
          member.status = 'retired';
          retired.push(member.agentId);
        } else {
          survivors.add(member.agentId);
        }
      }
    }

    const diversityScore = activeMembers.length === 0 ? 0 : grouped.size / activeMembers.length;
    const decision: SelectionDecision = {
      decisionId: `eco-${this.cycleCounter + 1}-${Date.now()}`,
      cycle: ++this.cycleCounter,
      survivors: Array.from(survivors),
      retired,
      promoted,
      diversityScore,
      rationale: retired.length > 0
        ? 'Low-fitness / low-energy members retired to preserve ecosystem efficiency'
        : 'Champions promoted while maintaining ecosystem diversity',
      createdAt: Date.now(),
    };

    this.decisions.push(decision);
    this.emit('selection', decision);
    logInfo('EvoEcosystem', `Selection cycle ${decision.cycle}: ${decision.survivors.length} survivors, ${decision.retired.length} retired`);
    return decision;
  }

  getChampion(niche?: string): EcosystemMember | undefined {
    const members = this.getMembers().filter(member => member.status !== 'retired' && (!niche || member.niche === niche));
    return members.sort((a, b) => b.fitness - a.fitness)[0];
  }

  getMembers(status?: EcosystemMember['status']): EcosystemMember[] {
    const values = Array.from(this.members.values());
    return status ? values.filter(member => member.status === status) : values;
  }

  getDecisions(): SelectionDecision[] {
    return [...this.decisions];
  }

  getStats(): { members: number; active: number; retired: number; cycles: number; diversity: number } {
    const activeMembers = this.getMembers().filter(member => member.status !== 'retired');
    const niches = new Set(activeMembers.map(member => member.niche));
    return {
      members: this.members.size,
      active: activeMembers.length,
      retired: this.getMembers('retired').length,
      cycles: this.decisions.length,
      diversity: activeMembers.length === 0 ? 0 : niches.size / activeMembers.length,
    };
  }
}
