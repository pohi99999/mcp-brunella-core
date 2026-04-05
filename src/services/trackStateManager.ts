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

        // Ensure tracks array exists
        if (!data.tracks || !Array.isArray(data.tracks)) {
          data.tracks = [];
        }

        return {
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          tracks: data.tracks,
          stats: this.calculateStats(data.tracks),
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

  /**
   * Parse meta.json with unified schema support
   */
  private parseMetaJson(metaPath: string, trackDir: string, isArchived: boolean): TrackMetadata | null {
    try {
      const raw = fs.readFileSync(metaPath, 'utf-8');
      // Strip BOM / zero-width chars that may precede JSON content
        const rawClean = raw.replace(/^(?:\uFEFF|\u200B|\u200C|\u200D|\u200E|\u200F)+/, '');
      const meta = JSON.parse(rawClean);

      // Unified ID extraction (supports both "id" and "track_id")
      const id = String(meta.id || meta.track_id || path.basename(trackDir));
      const name = String(meta.name || meta.title || id);

      // Status normalization
      let status: TrackMetadata['status'] = 'active';
      const statusRaw = String(meta.status || 'active').toLowerCase();
      if (['proposed', 'active', 'paused', 'completed', 'archived'].includes(statusRaw)) {
        status = statusRaw as TrackMetadata['status'];
      }

      // Priority mapping (P0/P1/P2/P3 → critical/high/medium/low)
      let priority: TrackMetadata['priority'] = 'medium';
      const priorityRaw = String(meta.priority || 'medium').toLowerCase();
      if (priorityRaw.includes('p0') || priorityRaw.includes('critical')) {
        priority = 'critical';
      } else if (priorityRaw.includes('p1') || priorityRaw.includes('high')) {
        priority = 'high';
      } else if (priorityRaw.includes('p2') || priorityRaw.includes('medium')) {
        priority = 'medium';
      } else if (priorityRaw.includes('p3') || priorityRaw.includes('low')) {
        priority = 'low';
      }

      // Progress validation (0-100)
      let progress = Number(meta.progress || 0);
      if (!Number.isFinite(progress) || progress < 0) {
        progress = 0;
      } else if (progress > 100) {
        progress = 100;
      }

      return {
        id,
        name,
        status,
        priority,
        progress,
        created: meta.created || meta.created_at,
        updated: meta.updated || meta.updated_at,
        completed: meta.completed,
        assignee: meta.assignee || meta.assigned_agent,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        dependencies: Array.isArray(meta.dependencies) ? meta.dependencies : [],
        _sourcePath: trackDir,
        _isArchived: isArchived,
      };
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
      const proposed = this.state.tracks.filter(t => t.status === 'proposed');
      const active = this.state.tracks.filter(t => t.status === 'active');
      const completed = this.state.tracks.filter(t => t.status === 'completed' && !t._isArchived);
      const archived = this.state.tracks.filter(t => t._isArchived);

      let content = `# Projekt Nyomkovetes (Tracks)\n\n`;
      content += `**Utolso frissites:** ${this.state.lastUpdated}\n`;
      content += `**Generator:** Track State Manager v2.0\n`;
      content += `**Auto-Sync:** Enabled (realtime)\n\n`;
      content += `**Stats:** ${this.state.stats.total} total | ${this.state.stats.active} active | ${this.state.stats.completed} completed | ${this.state.stats.archived} archived\n\n`;
      content += `---\n\n`;

      // Proposed
      content += `## Tervezett Szalak (Proposed) (${proposed.length})\n\n`;
      for (const t of proposed) {
        content += `- [ ] **${t.name}** [${t.priority.toUpperCase()}]\n`;
        content += `  - **ID:** \`${t.id}\`\n`;
        content += `  - **Progress:** ${t.progress}%\n`;
        if (t.assignee) content += `  - **Assignee:** ${t.assignee}\n`;
        content += `  - Mappa: ./tracks/${t.id}/\n\n`;
      }

      content += `---\n\n`;

      // Active
      content += `## Aktiv Szalak (Active) (${active.length})\n\n`;
      for (const t of active) {
        content += `- [${t.progress === 100 ? 'x' : ' '}] **${t.name}** [${t.priority.toUpperCase()}]\n`;
        content += `  - **ID:** \`${t.id}\`\n`;
        content += `  - **Progress:** ${t.progress}%\n`;
        if (t.assignee) content += `  - **Assignee:** ${t.assignee}\n`;
        if (t.updated) content += `  - **Updated:** ${t.updated}\n`;
        content += `  - Mappa: ./tracks/${t.id}/\n\n`;
      }

      content += `---\n\n`;

      // Completed (not archived yet)
      if (completed.length > 0) {
        content += `## Befejezett (Completed - Not Archived) (${completed.length})\n\n`;
        for (const t of completed) {
          content += `- [x] **${t.name}**\n`;
          content += `  - **ID:** \`${t.id}\`\n`;
          if (t.completed) content += `  - **Completed:** ${t.completed}\n`;
          content += `  - Mappa: ./tracks/${t.id}/\n\n`;
        }
        content += `---\n\n`;
      }

      // Archived
      content += `## Archivalt (Archived) (${archived.length})\n\n`;
      content += `> Archived tracks are hidden by default. View in \`conductor/archive/\`\n\n`;
      for (const t of archived.slice(0, 10)) {
        content += `- [x] **${t.name}** (${t.completed || t.updated || 'N/A'})\n`;
      }
      if (archived.length > 10) {
        content += `\n... and ${archived.length - 10} more archived tracks\n`;
      }

      content += `\n---\n\n`;
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
