import type { TrackGroupId } from '../utils/trackGroups.js';

export type TrackLifecycleStatus = 'active' | 'paused' | 'proposed' | 'completed' | 'archived';
export type TrackBucket = 'active' | 'proposed' | 'completed' | 'archived';
export type TrackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TrackStatusTrack {
  id: string;
  title: string;
  status: TrackLifecycleStatus;
  priority: TrackPriority;
  progress: number;
  group: TrackGroupId;
  assignee?: string;
  nextStep?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  dependencies?: string[];
  updated?: string;
  completed?: string;
}

export interface TrackStatusOverallStats {
  total: number;
  active: number;
  proposed: number;
  completed: number;
  archived: number;
}

export interface TrackStatusBusinessGroupStats extends TrackStatusOverallStats {
  averageProgress: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TrackStatusRecommendation {
  headline: string;
  rationale: string;
  nextSteps: string[];
  focusTrackId?: string;
  focusTrackTitle?: string;
}

export interface TrackStatusSnapshot {
  success: true;
  checkedAt: string;
  overallStats: TrackStatusOverallStats;
  businessGroupStats: TrackStatusBusinessGroupStats;
  activeBusinessTracks: TrackStatusTrack[];
  proposedBusinessTracks: TrackStatusTrack[];
  completedBusinessTracks: TrackStatusTrack[];
  archivedBusinessTracks: TrackStatusTrack[];
  recommendation: TrackStatusRecommendation;
}
