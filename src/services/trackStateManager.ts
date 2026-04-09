/**
 * Track State Manager - Centralized Track Synchronization Service
 *
 * Automatically syncs all tracks (active + archived) to project_state.json
 * Watches for meta.json changes and updates state in realtime
 *
 * @version 2.0.0
 * @author Claude Sonnet 4.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { fireHookSafely } from '../core/hookRegistry.js';
import {
  TRACK_GROUP_LABELS,
  TRACK_GROUP_ORDER,
  groupTracksByGroup,
  inferTrackGroup,
  type TrackGroupId,
} from '../utils/trackGroups.js';
import chokidar, { FSWatcher } from 'chokidar';

// ============================================================================
// INTERFACES
// ============================================================================

export interface TrackMetadata {
  // Unified schema (supports both "id" and "track_id")
  id: string;
  name: string;
  status: 'proposed' | 'active' | 'paused' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number; // 0-100
  created?: string;
  updated?: string;
  completed?: string;
  assignee?: string;
  tags?: string[];
  dependencies?: string[];
  group: TrackGroupId;

  // Original path (active or archived)
  _sourcePath?: string;
  _isArchived?: boolean;
}

export interface ProjectState {
  lastUpdated: string;
  tracks: TrackMetadata[];
  stats: {
    total: number;
    active: number;
    completed: number;
    archived: number;
    proposed: number;
  };
}

type TrackSectionMode = 'proposed' | 'active' | 'completed' | 'archived';

// ============================================================================
// CONSTANTS
// ============================================================================

const PROJECT_ROOT = process.cwd();
const CONDUCTOR_PATH = path.join(PROJECT_ROOT, 'conductor');
const STATE_FILE = path.join(CONDUCTOR_PATH, 'project_state.json');
const TRACKS_DIR = path.join(CONDUCTOR_PATH, 'tracks');
const ARCHIVE_DIR = path.join(CONDUCTOR_PATH, 'archive');
const TRACKS_MD = path.join(CONDUCTOR_PATH, 'tracks.md');

// ============================================================================
// TRACK STATE MANAGER CLASS
// ============================================================================

export class TrackStateManager {
  private state: ProjectState;
  private watcher: FSWatcher | null = null;
  private syncInProgress = false;

  constructor() {
    this.state = this.loadState();
  }

  private async emitTrackLifecycleHooks(
    previousTracks: Map<string, TrackMetadata>,
    nextTracks: TrackMetadata[],
  ): Promise<void> {
    for (const track of nextTracks) {
      const previous = previousTracks.get(track.id);
      if (!previous) {
        continue;
      }

      if (previous.status !== track.status || previous.progress !== track.progress || previous._isArchived !== track._isArchived) {
        await fireHookSafely('track:status:changed', {
          trackId: track.id,
          trackName: track.name,
          previousStatus: previous.status,
          status: track.status,
          previousProgress: previous.progress,
          progress: track.progress,
          archived: track._isArchived,
          updated: track.updated ?? new Date().toISOString(),
        }, {
          source: 'track-state-manager',
          metadata: { trackId: track.id, status: track.status },
          logContext: 'TrackStateManager',
        });
      }

      if (previous.status !== 'completed' && track.status === 'completed') {
        await fireHookSafely('track:completed', {
          trackId: track.id,
          trackName: track.name,
          completedAt: track.completed ?? track.updated ?? new Date().toISOString(),
          progress: track.progress,
          assignee: track.assignee,
        }, {
          source: 'track-state-manager',
          metadata: { trackId: track.id },
          logContext: 'TrackStateManager',
        });
      }
    }
  }

  /**
   * Load state from project_state.json (or create new)
   */
  private loadState(): ProjectState {
    if (fs.existsSync(STATE_FILE)) {
      try {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        // Remove BOM or common zero-width characters at the start to avoid JSON.parse errors
        const rawClean = raw.replace(/^(?:\uFEFF|\u200B|\u200C|\u200D|\u200E|\u200F)+/, '');
        const data = JSON.parse(rawClean);

        const rawTracks: unknown[] = Array.isArray(data.tracks) ? data.tracks : [];
        const tracks = rawTracks
          .map((track) => {
            if (!track || typeof track !== 'object') {
              return null;
            }

            return this.normalizeTrackRecord(track as Record<string, unknown>);
          })
          .filter((track): track is TrackMetadata => track !== null);

        return {
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          tracks,
          stats: this.calculateStats(tracks),
        };
      } catch (e) {
        logError('TrackStateManager', `State load failed: ${e}. Creating new state.`);
      }
    }

    // Default empty state
    return {
      lastUpdated: new Date().toISOString(),
      tracks: [],
      stats: { total: 0, active: 0, completed: 0, archived: 0, proposed: 0 },
    };
  }

  /**
   * Save state to project_state.json
   */
  private saveState(): void {
    try {
      this.state.lastUpdated = new Date().toISOString();
      this.state.stats = this.calculateStats(this.state.tracks);

      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
      logInfo('TrackStateManager', `State saved: ${this.state.tracks.length} tracks`);
    } catch (e) {
      logError('TrackStateManager', `State save failed: ${e}`);
    }
  }

  /**
   * Calculate stats from tracks
   */
  private calculateStats(tracks: TrackMetadata[]): ProjectState['stats'] {
    return {
      total: tracks.length,
      active: tracks.filter(t => t.status === 'active').length,
      completed: tracks.filter(t => t.status === 'completed').length,
      archived: tracks.filter(t => t._isArchived).length,
      proposed: tracks.filter(t => t.status === 'proposed').length,
    };
  }

  private normalizeTrackRecord(
    record: Record<string, unknown>,
    trackDir?: string,
    isArchived?: boolean,
  ): TrackMetadata | null {
    const pickString = (...values: unknown[]): string | undefined => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }

      return undefined;
    };

    const id = pickString(
      record.id,
      record.track_id,
      record.trackId,
      trackDir ? path.basename(trackDir) : undefined,
    );

    if (!id) {
      return null;
    }

    const name = pickString(record.name, record.title, id) || id;
    const title = pickString(record.title, record.name, name) || name;

    let status: TrackMetadata['status'] = 'active';
    const statusRaw = pickString(record.status, 'active')?.toLowerCase() || 'active';
    if (['proposed', 'planning'].includes(statusRaw)) {
      status = 'proposed';
    } else if (['active', 'in_progress', 'testing'].includes(statusRaw)) {
      status = 'active';
    } else if (['completed', 'done'].includes(statusRaw)) {
      status = 'completed';
    } else if (statusRaw === 'paused') {
      status = 'paused';
    } else if (statusRaw === 'archived') {
      status = 'archived';
    }

    if (isArchived) {
      status = 'archived';
    }

    let priority: TrackMetadata['priority'] = 'medium';
    const priorityRaw = pickString(record.priority, 'medium')?.toLowerCase() || 'medium';
    if (priorityRaw.includes('p0') || priorityRaw.includes('critical')) {
      priority = 'critical';
    } else if (priorityRaw.includes('p1') || priorityRaw.includes('high')) {
      priority = 'high';
    } else if (priorityRaw.includes('p2') || priorityRaw.includes('medium')) {
      priority = 'medium';
    } else if (priorityRaw.includes('p3') || priorityRaw.includes('low')) {
      priority = 'low';
    }

    let progress = Number(record.progress ?? 0);
    if (!Number.isFinite(progress) || progress < 0) {
      progress = 0;
    } else if (progress > 100) {
      progress = 100;
    }

    const tags = Array.isArray(record.tags) ? record.tags.map((tag) => String(tag)) : [];
    const dependencies = Array.isArray(record.dependencies)
      ? record.dependencies.map((dependency) => String(dependency))
      : [];

    const sourcePath = pickString(record._sourcePath, trackDir);
    const archived = typeof record._isArchived === 'boolean' ? record._isArchived : Boolean(isArchived || status === 'archived');

    return {
      id,
      name,
      status,
      priority,
      progress,
      created: pickString(record.created, record.createdAt, record.created_at),
      updated: pickString(record.updated, record.updatedAt, record.updated_at),
      completed: pickString(record.completed, record.completedAt, record.completed_at),
      assignee: pickString(record.assignee, record.assigned_agent, record.owner),
      tags,
      dependencies,
      group: inferTrackGroup({
        id,
        name,
        title,
        description: pickString(record.description),
        sourceDocument: pickString(record.sourceDocument),
        tags,
        group: record.group,
      }),
      _sourcePath: sourcePath,
      _isArchived: archived,
    };
  }

  private sortTracksForDisplay(tracks: TrackMetadata[]): TrackMetadata[] {
    const priorityRank: Record<TrackMetadata['priority'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...tracks].sort((a, b) => {
      const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const groupDiff = TRACK_GROUP_ORDER.indexOf(a.group) - TRACK_GROUP_ORDER.indexOf(b.group);
      if (groupDiff !== 0) {
        return groupDiff;
      }

      return a.name.localeCompare(b.name);
    });
  }

  private calculateGroupStats(tracks: TrackMetadata[]): Record<TrackGroupId, number> {
    const stats: Record<TrackGroupId, number> = {
      business: 0,
      nova: 0,
      brunella: 0,
      other: 0,
    };

    for (const track of tracks) {
      stats[track.group] += 1;
    }

    return stats;
  }

  private formatTrackEntry(track: TrackMetadata, mode: TrackSectionMode): string {
    if (mode === 'completed') {
      let content = `- [x] **${track.name}**\n`;
      content += `  - **ID:** \`${track.id}\`\n`;
      if (track.completed) content += `  - **Completed:** ${track.completed}\n`;
      content += `  - Mappa: ./tracks/${track.id}/\n\n`;
      return content;
    }

    if (mode === 'archived') {
      let content = `- [x] **${track.name}**`;
      if (track.completed || track.updated) {
        content += ` (${track.completed || track.updated})`;
      }
      content += `\n`;
      return content;
    }

    let content = `- [${mode === 'active' && track.progress === 100 ? 'x' : ' '}] **${track.name}** [${track.priority.toUpperCase()}]\n`;
    content += `  - **ID:** \`${track.id}\`\n`;
    content += `  - **Progress:** ${track.progress}%\n`;
    if (track.assignee) content += `  - **Assignee:** ${track.assignee}\n`;
    if (mode === 'active' && track.updated) content += `  - **Updated:** ${track.updated}\n`;
    content += `  - Mappa: ./tracks/${track.id}/\n\n`;
    return content;
  }

  /**
   * Parse meta.json with unified schema support
   */
  private parseMetaJson(metaPath: string, trackDir: string, isArchived: boolean): TrackMetadata | null {
    try {
      const raw = fs.readFileSync(metaPath, 'utf-8');
      const rawClean = raw.replace(/^(?:\uFEFF|\u200B|\u200C|\u200D|\u200E|\u200F)+/, '');
      const meta = JSON.parse(rawClean) as Record<string, unknown>;

      return this.normalizeTrackRecord(meta, trackDir, isArchived);
    } catch (e) {
      logError('TrackStateManager', `Failed to parse ${metaPath}: ${e}`);
      return null;
    }
  }

  /**
   * Scan all tracks (active + archived)
   */
  public async fullSync(): Promise<void> {
    if (this.syncInProgress) {
      logWarn('TrackStateManager', 'Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    logInfo('TrackStateManager', 'Starting full sync (active + archived)...');
    const previousTracks = new Map(this.state.tracks.map((track) => [track.id, track]));

    const trackMap = new Map<string, TrackMetadata>();
    const registerTrack = (track: TrackMetadata): void => {
      const existing = trackMap.get(track.id);
      if (existing) {
        const existingScope = existing._isArchived ? 'archived' : 'active';
        const incomingScope = track._isArchived ? 'archived' : 'active';
        logWarn('TrackStateManager', `Duplicate track id ${track.id} found in ${existingScope} and ${incomingScope}; preferring ${incomingScope} entry`);
      }

      trackMap.set(track.id, track);
    };

    try {
      // 1. Scan ACTIVE tracks
      if (fs.existsSync(TRACKS_DIR)) {
        const activeDirs = fs.readdirSync(TRACKS_DIR).filter(f => {
          const fullPath = path.join(TRACKS_DIR, f);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const dir of activeDirs) {
          const metaPath = path.join(TRACKS_DIR, dir, 'meta.json');
          if (fs.existsSync(metaPath)) {
            const track = this.parseMetaJson(metaPath, path.join(TRACKS_DIR, dir), false);
            if (track) {
              registerTrack(track);
            }
          } else {
            logWarn('TrackStateManager', `No meta.json in ${dir} (skipping)`);
          }
        }
      }

      // 2. Scan ARCHIVED tracks
      if (fs.existsSync(ARCHIVE_DIR)) {
        const archiveDirs = fs.readdirSync(ARCHIVE_DIR).filter(f => {
          const fullPath = path.join(ARCHIVE_DIR, f);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const dir of archiveDirs) {
          const metaPath = path.join(ARCHIVE_DIR, dir, 'meta.json');
          if (fs.existsSync(metaPath)) {
            const track = this.parseMetaJson(metaPath, path.join(ARCHIVE_DIR, dir), true);
            if (track) {
              // Force archived status
              track.status = 'archived';
              track._isArchived = true;
              registerTrack(track);
            }
          }
        }
      }

      // 3. Update state
      const newTracks = Array.from(trackMap.values());
      this.state.tracks = newTracks;
      this.saveState();

      // 4. Generate tracks.md
      await this.generateTracksMd();
      await this.emitTrackLifecycleHooks(previousTracks, newTracks);

      logInfo('TrackStateManager', `✅ Full sync complete: ${newTracks.length} tracks (${this.state.stats.active} active, ${this.state.stats.archived} archived)`);
    } catch (e) {
      logError('TrackStateManager', `Full sync failed: ${e}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Generate tracks.md from state
   */
  private async generateTracksMd(): Promise<void> {
    try {
      const proposed = this.sortTracksForDisplay(
        this.state.tracks.filter((track) => track.status === 'proposed'),
      );
      const active = this.sortTracksForDisplay(
        this.state.tracks.filter((track) => track.status === 'active'),
      );
      const completed = this.sortTracksForDisplay(
        this.state.tracks.filter((track) => track.status === 'completed' && !track._isArchived),
      );
      const archived = this.sortTracksForDisplay(
        this.state.tracks.filter((track) => track._isArchived),
      );
      const groupStats = this.calculateGroupStats(this.state.tracks);

      const renderGroupedSection = (
        title: string,
        tracks: TrackMetadata[],
        mode: TrackSectionMode,
        note?: string,
      ): string => {
        let section = `## ${title} (${tracks.length})\n\n`;

        if (note) {
          section += `${note}\n\n`;
        }

        if (tracks.length === 0) {
          section += `_Nincs track ebben a szekcioban._\n\n`;
          section += `---\n\n`;
          return section;
        }

        const grouped = groupTracksByGroup(tracks);
        for (const group of TRACK_GROUP_ORDER) {
          const groupTracks = grouped[group];
          if (groupTracks.length === 0) {
            continue;
          }

          section += `### ${TRACK_GROUP_LABELS[group]} (${groupTracks.length})\n\n`;
          for (const track of groupTracks) {
            section += this.formatTrackEntry(track, mode);
          }
          section += `\n`;
        }

        section += `---\n\n`;
        return section;
      };

      let content = `# Projekt Nyomkovetes (Tracks)\n\n`;
      content += `**Utolso frissites:** ${this.state.lastUpdated}\n`;
      content += `**Generator:** Track State Manager v2.0\n`;
      content += `**Auto-Sync:** Enabled (realtime)\n\n`;
      content += `**Stats:** ${this.state.stats.total} total | ${this.state.stats.active} active | ${this.state.stats.completed} completed | ${this.state.stats.archived} archived\n`;
      content += `**Csoportok:** ${TRACK_GROUP_ORDER.map((group) => `${TRACK_GROUP_LABELS[group]}: ${groupStats[group]}`).join(' | ')}\n\n`;
      content += `---\n\n`;
      content += renderGroupedSection('Tervezett Szalak (Proposed)', proposed, 'proposed');
      content += renderGroupedSection('Aktiv Szalak (Active)', active, 'active');

      if (completed.length > 0) {
        content += renderGroupedSection('Befejezett (Completed - Not Archived)', completed, 'completed');
      }

      content += renderGroupedSection(
        'Archivalt (Archived)',
        archived,
        'archived',
        '> Archived tracks are hidden by default. View in `conductor/archive/`',
      );
      content += `*Auto-generated by Track State Manager v2.0*\n`;

      fs.writeFileSync(TRACKS_MD, content, 'utf-8');
      logInfo('TrackStateManager', '✅ tracks.md generated');
    } catch (e) {
      logError('TrackStateManager', `Failed to generate tracks.md: ${e}`);
    }
  }

  /**
   * Start file watcher (realtime sync)
   */
  public startWatcher(): void {
    if (this.watcher) {
      logWarn('TrackStateManager', 'Watcher already running');
      return;
    }

    logInfo('TrackStateManager', 'Starting file watcher (meta.json changes)...');

    this.watcher = chokidar.watch(
      [
        path.join(TRACKS_DIR, '*/meta.json'),
        path.join(ARCHIVE_DIR, '*/meta.json'),
      ],
      {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100,
        },
      }
    );

    this.watcher.on('change', async (filePath: string) => {
      logInfo('TrackStateManager', `📝 meta.json changed: ${filePath}`);
      await this.fullSync();
    });

    this.watcher.on('add', async (filePath: string) => {
      logInfo('TrackStateManager', `➕ meta.json added: ${filePath}`);
      await this.fullSync();
    });

    this.watcher.on('unlink', async (filePath: string) => {
      logInfo('TrackStateManager', `➖ meta.json removed: ${filePath}`);
      await this.fullSync();
    });

    logInfo('TrackStateManager', '✅ File watcher active');
  }

  /**
   * Stop file watcher
   */
  public stopWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logInfo('TrackStateManager', 'File watcher stopped');
    }
  }

  /**
   * Get current state (read-only)
   */
  public getState(): Readonly<ProjectState> {
    return this.state;
  }

  /**
   * Get active tracks only (filter for Dashboard)
   */
  public getActiveTracks(): TrackMetadata[] {
    return this.state.tracks.filter(t => t.status === 'active' || t.status === 'proposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const trackStateManager = new TrackStateManager();
