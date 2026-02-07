/**
 * ProjectConductorAgent - A Brunella projekt "Karmestere"
 * 
 * Felelősségek:
 * 1. Projekt állapot folyamatos monitorozása
 * 2. Dokumentáció naprakészen tartása (BRUNELLA.md, konyvtarfa.md, tracks.md)
 * 3. Fejlesztési szálak (tracks) koordinálása
 * 4. Változások detektálása és naplózása
 * 5. Konfliktusok megelőzése több szálon futó fejlesztésnél
 * 
 * @author Brunella Core Team
 * @version 1.0.0
 */

import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============================================================================
// INTERFACES
// ============================================================================

interface ProjectState {
  lastUpdated: string;
  tracks: TrackState[];
  components: ComponentState[];
  recentChanges: ChangeEntry[];
  healthStatus: HealthStatus;
}

interface TrackState {
  id: string;
  name: string;
  status: 'proposed' | 'active' | 'paused' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number; // 0-100
  lastActivity: string;
  blockers: string[];
  assignee?: string;
}

interface ComponentState {
  name: string;
  path: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastModified: string;
  dependencies: string[];
}

interface ChangeEntry {
  timestamp: string;
  type: 'file' | 'track' | 'config' | 'agent' | 'documentation';
  action: 'created' | 'modified' | 'deleted' | 'moved';
  path: string;
  description: string;
  author?: string;
}

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  buildStatus: boolean;
  testStatus: boolean;
  documentationSync: boolean;
  lastHealthCheck: string;
}

interface DocumentationFile {
  path: string;
  type: 'primary' | 'conductor' | 'technical';
  autoUpdate: boolean;
  lastSync: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROJECT_ROOT = process.cwd();
const CONDUCTOR_PATH = path.join(PROJECT_ROOT, 'conductor');
const STATE_FILE = path.join(CONDUCTOR_PATH, 'project_state.json');

const DOCUMENTATION_FILES: DocumentationFile[] = [
  { path: 'Brunella.md', type: 'primary', autoUpdate: true, lastSync: '' },
  { path: 'konyvtarfa.md', type: 'technical', autoUpdate: true, lastSync: '' },
  { path: 'conductor/tracks.md', type: 'conductor', autoUpdate: true, lastSync: '' },
  { path: 'conductor/SUMMARY.md', type: 'conductor', autoUpdate: true, lastSync: '' },
  { path: 'conductor/workflow.md', type: 'conductor', autoUpdate: false, lastSync: '' },
  { path: 'conductor/tech-stack.md', type: 'conductor', autoUpdate: false, lastSync: '' },
];

const MONITORED_DIRECTORIES = [
  'src/agents',
  'src/tools',
  'src/server',
  'src/core',
  'myai',
  'conductor/tracks',
  'cloudflare',
];

// ============================================================================
// AGENT IMPLEMENTATION
// ============================================================================

export class ProjectConductorAgent extends BaseAgent {
  name = 'ProjectConductor';
  description = 'Projekt állapot monitorozás, dokumentáció szinkronizálás, track koordináció';
  role = 'Project Manager & Documentation Conductor';
  
  private projectState: ProjectState;
  private isRunning = false;

  constructor() {
    super();
    this.projectState = this.loadOrInitializeState();
  }

  // --------------------------------------------------------------------------
  // MAIN EXECUTION
  // --------------------------------------------------------------------------

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task?.toLowerCase() || '';
    setAgentStatus(this.name, 'working', task);

    try {
      // Command routing
      if (task.includes('status') || task.includes('állapot')) {
        return await this.getProjectStatus();
      }
      
      if (task.includes('sync') || task.includes('szinkron')) {
        return await this.syncDocumentation();
      }
      
      if (task.includes('track') && task.includes('create')) {
        const trackName = this.extractTrackName(task);
        return await this.createTrack(trackName, context);
      }
      
      if (task.includes('track') && (task.includes('update') || task.includes('frissít'))) {
        return await this.updateTracks();
      }
      
      if (task.includes('health') || task.includes('egészség')) {
        return await this.runHealthCheck();
      }
      
      if (task.includes('changes') || task.includes('változás')) {
        return await this.getRecentChanges();
      }
      
      if (task.includes('tree') || task.includes('fa') || task.includes('konyvtarfa')) {
        return await this.updateDirectoryTree();
      }
      
      if (task.includes('full') || task.includes('teljes')) {
        return await this.fullProjectSync();
      }

      // Default: show help
      return this.showHelp();
      
    } catch (error) {
      logError(this.name, `Hiba: ${error}`);
      setAgentStatus(this.name, 'error');
      return {
        success: false,
        message: `ProjectConductor hiba: ${error}`,
        data: null
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // --------------------------------------------------------------------------
  // CORE FUNCTIONS
  // --------------------------------------------------------------------------

  /**
   * Teljes projekt státusz lekérdezése
   */
  private async getProjectStatus(): Promise<AgentResult> {
    logInfo(this.name, 'Projekt státusz lekérdezése...');
    
    await this.refreshProjectState();
    
    const activeTracks = this.projectState.tracks.filter(t => t.status === 'active');
    const completedTracks = this.projectState.tracks.filter(t => t.status === 'completed');
    const recentChanges = this.projectState.recentChanges.slice(0, 10);
    
    const statusReport = `
# 📊 Projekt Státusz Jelentés

**Generálva:** ${new Date().toISOString()}
**Utolsó frissítés:** ${this.projectState.lastUpdated}

## 🏥 Egészségi Állapot
- **Összesített:** ${this.projectState.healthStatus.overall === 'healthy' ? '✅ Egészséges' : '⚠️ ' + this.projectState.healthStatus.overall}
- **Build:** ${this.projectState.healthStatus.buildStatus ? '✅' : '❌'}
- **Tesztek:** ${this.projectState.healthStatus.testStatus ? '✅' : '❌'}
- **Dokumentáció szinkron:** ${this.projectState.healthStatus.documentationSync ? '✅' : '❌'}

## 🚀 Aktív Fejlesztési Szálak (${activeTracks.length})
${activeTracks.map(t => `- **${t.name}** [${t.priority.toUpperCase()}] - ${t.progress}% ${t.blockers.length > 0 ? '⚠️ Blokkolók: ' + t.blockers.join(', ') : ''}`).join('\n')}

## ✅ Lezárt Szálak (${completedTracks.length})
${completedTracks.slice(0, 5).map(t => `- ${t.name}`).join('\n')}

## 📝 Legutóbbi Változások
${recentChanges.map(c => `- [${c.timestamp.slice(0, 10)}] ${c.action}: ${c.path}`).join('\n')}

## 📁 Komponens Állapotok
${this.projectState.components.map(c => `- **${c.name}:** ${c.status === 'healthy' ? '✅' : c.status === 'warning' ? '⚠️' : '❌'}`).join('\n')}
`;

    return {
      success: true,
      message: 'Projekt státusz sikeresen lekérdezve',
      data: {
        report: statusReport,
        state: this.projectState
      }
    };
  }

  /**
   * Dokumentáció szinkronizálása
   */
  private async syncDocumentation(): Promise<AgentResult> {
    logInfo(this.name, 'Dokumentáció szinkronizálás indítása...');
    
    const results: string[] = [];
    
    for (const doc of DOCUMENTATION_FILES) {
      if (!doc.autoUpdate) continue;
      
      try {
        const fullPath = path.join(PROJECT_ROOT, doc.path);
        
        if (doc.path === 'konyvtarfa.md') {
          await this.updateDirectoryTree();
          results.push(`✅ ${doc.path} frissítve`);
        } else if (doc.path === 'conductor/tracks.md') {
          await this.updateTracksFile();
          results.push(`✅ ${doc.path} frissítve`);
        } else if (doc.path === 'Brunella.md') {
          await this.updateBrunellaFile();
          results.push(`✅ ${doc.path} frissítve`);
        } else if (doc.path === 'conductor/SUMMARY.md') {
          await this.updateSummaryFile();
          results.push(`✅ ${doc.path} frissítve`);
        }
        
        doc.lastSync = new Date().toISOString();
      } catch (error) {
        results.push(`❌ ${doc.path}: ${error}`);
      }
    }
    
    this.saveState();
    
    return {
      success: true,
      message: 'Dokumentáció szinkronizálás befejezve',
      data: { results }
    };
  }

  /**
   * Új track létrehozása
   */
  private async createTrack(name: string, context: AgentContext): Promise<AgentResult> {
    const trackId = `${name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const trackDir = path.join(CONDUCTOR_PATH, 'tracks', trackId);
    
    logInfo(this.name, `Új track létrehozása: ${trackId}`);
    
    // Mappa létrehozása
    if (!fs.existsSync(trackDir)) {
      fs.mkdirSync(trackDir, { recursive: true });
    }
    
    // plan.md létrehozása
    const planContent = `# Track: ${name}

**ID:** \`${trackId}\`
**Státusz:** 🟡 Active
**Prioritás:** MEDIUM
**Létrehozva:** ${new Date().toISOString()}

---

## 🎯 Célok

[Írd le a track céljait]

---

## 📋 Feladatok

- [ ] Feladat 1
- [ ] Feladat 2
- [ ] Feladat 3

---

## ✅ Elfogadási Kritériumok

- [ ] Kritérium 1
- [ ] Kritérium 2

---

## 📝 Napló

### ${new Date().toISOString().slice(0, 10)}
- Track létrehozva
`;
    
    fs.writeFileSync(path.join(trackDir, 'plan.md'), planContent);
    
    // Track hozzáadása az állapothoz
    const newTrack: TrackState = {
      id: trackId,
      name,
      status: 'active',
      priority: 'medium',
      progress: 0,
      lastActivity: new Date().toISOString(),
      blockers: []
    };
    
    this.projectState.tracks.push(newTrack);
    this.addChangeEntry('track', 'created', trackDir, `Új track: ${name}`);
    this.saveState();
    
    // tracks.md frissítése
    await this.updateTracksFile();
    
    return {
      success: true,
      message: `Track sikeresen létrehozva: ${trackId}`,
      data: { track: newTrack, path: trackDir }
    };
  }

  /**
   * Track-ek frissítése
   */
  private async updateTracks(): Promise<AgentResult> {
    logInfo(this.name, 'Track-ek frissítése...');
    
    const tracksDir = path.join(CONDUCTOR_PATH, 'tracks');

    let trackDirs: string[] = [];
    try {
      const entries = await fs.promises.readdir(tracksDir, { withFileTypes: true });
      trackDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        trackDirs = [];
      } else {
        logError(this.name, `Nem sikerült olvasni a tracks könyvtárat: ${error}`);
        return { success: false, message: 'Hiba a tracks könyvtár olvasásakor', data: error };
      }
    }
    
    const updatedTracks: TrackState[] = [];
    const CONCURRENCY_LIMIT = 50;
    
    // Chunk-okban dolgozzuk fel a track-eket a concurrency limit betartásához
    for (let i = 0; i < trackDirs.length; i += CONCURRENCY_LIMIT) {
      const chunk = trackDirs.slice(i, i + CONCURRENCY_LIMIT);

      const chunkResults = await Promise.all(chunk.map(async (dir) => {
        const planPath = path.join(tracksDir, dir, 'plan.md');
        try {
          // Aszinkron fájl stat és olvasás
          const stats = await fs.promises.stat(planPath);
          const content = await fs.promises.readFile(planPath, 'utf-8');

          // Státusz és progress kinyerése a plan.md-ből
          const statusMatch = content.match(/Státusz:\s*([🟢🟡🔴⏸️✅])\s*(\w+)/);
          const progressMatch = content.match(/Progress:\s*(\d+)%/);
          const priorityMatch = content.match(/Prioritás:\s*(\w+)/i);

          const existingTrack = this.projectState.tracks.find(t => t.id === dir);

          return {
            id: dir,
            name: this.extractTrackNameFromContent(content) || dir,
            status: this.parseStatus(statusMatch?.[2] || existingTrack?.status || 'active'),
            priority: this.parsePriority(priorityMatch?.[1] || existingTrack?.priority || 'medium'),
            progress: parseInt(progressMatch?.[1] || '0'),
            lastActivity: stats.mtime.toISOString(),
            blockers: existingTrack?.blockers || [],
            assignee: existingTrack?.assignee
          } as TrackState;
        } catch (error: any) {
          // Ha nincs plan.md, vagy nem olvasható, kihagyjuk
          if (error.code !== 'ENOENT') {
            logError(this.name, `Hiba a track feldolgozásakor (${dir}): ${error.message}`);
          }
          return null;
        }
      }));

      updatedTracks.push(...chunkResults.filter((t): t is TrackState => t !== null));
    }
    
    this.projectState.tracks = updatedTracks;
    this.saveState();
    await this.updateTracksFile();
    
    return {
      success: true,
      message: `${updatedTracks.length} track frissítve`,
      data: { tracks: updatedTracks }
    };
  }

  /**
   * Health check futtatása
   */
  private async runHealthCheck(): Promise<AgentResult> {
    logInfo(this.name, 'Health check futtatása...');
    
    const health: HealthStatus = {
      overall: 'healthy',
      buildStatus: false,
      testStatus: false,
      documentationSync: true,
      lastHealthCheck: new Date().toISOString()
    };
    
    // Build ellenőrzés
    try {
      execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      health.buildStatus = true;
      logInfo(this.name, '✅ Build sikeres');
    } catch {
      health.buildStatus = false;
      health.overall = 'degraded';
      logError(this.name, '❌ Build sikertelen');
    }
    
    // Test ellenőrzés (gyors)
    try {
      execSync('npm run test -- --passWithNoTests --maxWorkers=1', { 
        cwd: PROJECT_ROOT, 
        stdio: 'pipe',
        timeout: 60000 
      });
      health.testStatus = true;
      logInfo(this.name, '✅ Tesztek sikeresek');
    } catch {
      health.testStatus = false;
      health.overall = 'degraded';
      logError(this.name, '❌ Tesztek sikertelenek');
    }
    
    // Dokumentáció szinkron ellenőrzés
    for (const doc of DOCUMENTATION_FILES.filter(d => d.autoUpdate)) {
      const fullPath = path.join(PROJECT_ROOT, doc.path);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        const hoursSinceUpdate = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 24) {
          health.documentationSync = false;
          health.overall = health.overall === 'healthy' ? 'degraded' : health.overall;
        }
      }
    }
    
    if (!health.buildStatus && !health.testStatus) {
      health.overall = 'critical';
    }
    
    this.projectState.healthStatus = health;
    this.saveState();
    
    return {
      success: true,
      message: `Health check befejezve: ${health.overall}`,
      data: { health }
    };
  }

  /**
   * Teljes projekt szinkronizálás
   */
  private async fullProjectSync(): Promise<AgentResult> {
    logInfo(this.name, '🔄 Teljes projekt szinkronizálás indítása...');
    
    const results: string[] = [];
    
    // 1. Track-ek frissítése
    const trackResult = await this.updateTracks();
    results.push(`Tracks: ${trackResult.message}`);
    
    // 2. Dokumentáció szinkron
    const docResult = await this.syncDocumentation();
    results.push(`Docs: ${docResult.message}`);
    
    // 3. Health check
    const healthResult = await this.runHealthCheck();
    results.push(`Health: ${healthResult.message}`);
    
    // 4. Könyvtárfa frissítés
    const treeResult = await this.updateDirectoryTree();
    results.push(`Tree: ${treeResult.message}`);
    
    // 5. Változások naplózása
    this.addChangeEntry('documentation', 'modified', 'project', 'Teljes projekt szinkronizálás');
    
    this.projectState.lastUpdated = new Date().toISOString();
    this.saveState();
    
    return {
      success: true,
      message: 'Teljes projekt szinkronizálás befejezve',
      data: { results }
    };
  }

  // --------------------------------------------------------------------------
  // DOCUMENTATION GENERATORS
  // --------------------------------------------------------------------------

  /**
   * konyvtarfa.md frissítése
   */
  private async updateDirectoryTree(): Promise<AgentResult> {
    logInfo(this.name, 'Könyvtárfa frissítése...');
    
    const tree = this.generateDirectoryTree(PROJECT_ROOT, 0, 3);
    const content = `# Projekt Könyvtárfa

**Generálva:** ${new Date().toISOString()}
**Generátor:** ProjectConductorAgent

---

\`\`\`
${tree}
\`\`\`

---

## Főbb Mappák

| Mappa | Leírás |
|-------|--------|
| \`src/\` | TypeScript forráskód |
| \`src/agents/\` | AI ügynökök |
| \`src/tools/\` | MCP eszközök |
| \`src/server/\` | Backend szerver |
| \`myai/\` | Python alrendszer |
| \`conductor/\` | Projekt menedzsment |
| \`cloudflare/\` | Edge computing |
| \`_KNOWLEDGE_BASE/\` | Tudásbázis |

---

*Automatikusan generálva a ProjectConductorAgent által*
`;
    
    fs.writeFileSync(path.join(PROJECT_ROOT, 'konyvtarfa.md'), content);
    
    return {
      success: true,
      message: 'Könyvtárfa frissítve',
      data: null
    };
  }

  /**
   * tracks.md frissítése
   */
  private async updateTracksFile(): Promise<AgentResult> {
    const activeTracks = this.projectState.tracks.filter(t => t.status === 'active');
    const completedTracks = this.projectState.tracks.filter(t => t.status === 'completed');
    const pausedTracks = this.projectState.tracks.filter(t => t.status === 'paused');
    
    const content = `# Projekt Nyomkövetés (Tracks)

**Utolsó frissítés:** ${new Date().toISOString()}
**Generátor:** ProjectConductorAgent

Ez a fájl követi nyomon a fő fejlesztési szálakat (tracks).

---

## 🚀 Aktív Szálak (${activeTracks.length})

${activeTracks.map(t => `- [ ] **${t.name}** [${t.priority.toUpperCase()}]
  - **ID:** \`${t.id}\`
  - **Progress:** ${t.progress}%
  - **Utolsó aktivitás:** ${t.lastActivity.slice(0, 10)}
  ${t.blockers.length > 0 ? `- **Blokkolók:** ${t.blockers.join(', ')}` : ''}
  - 📂 *[./tracks/${t.id}/](./tracks/${t.id}/)*
`).join('\n')}

---

## ⏸️ Szüneteltetett Szálak (${pausedTracks.length})

${pausedTracks.map(t => `- [ ] **${t.name}**
  - 📂 *[./tracks/${t.id}/](./tracks/${t.id}/)*
`).join('\n') || '*Nincs szüneteltetett szál*'}

---

## ✅ Lezárt Szálak (${completedTracks.length})

${completedTracks.slice(0, 20).map(t => `- [x] **${t.name}** (${t.lastActivity.slice(0, 10)})
  - 📂 *[./tracks/${t.id}/](./tracks/${t.id}/)*
`).join('\n')}

---

*Automatikusan generálva a ProjectConductorAgent által*
`;
    
    fs.writeFileSync(path.join(CONDUCTOR_PATH, 'tracks.md'), content);
    
    return {
      success: true,
      message: 'tracks.md frissítve',
      data: null
    };
  }

  /**
   * BRUNELLA.md frissítése
   */
  private async updateBrunellaFile(): Promise<AgentResult> {
    const brunellaPath = path.join(PROJECT_ROOT, 'Brunella.md');
    
    if (!fs.existsSync(brunellaPath)) {
      logError(this.name, 'Brunella.md nem található');
      return { success: false, message: 'Brunella.md nem található', data: null };
    }
    
    let content = fs.readFileSync(brunellaPath, 'utf-8');
    
    // Dátum frissítése
    const dateRegex = /\*\*Dátum:\*\*\s*\d{4}\.\s*\w+\s*\d+\.,\s*\w+/;
    const now = new Date();
    const hungarianDate = now.toLocaleDateString('hu-HU', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
    
    if (dateRegex.test(content)) {
      content = content.replace(dateRegex, `**Dátum:** ${hungarianDate}`);
    }
    
    // Aktív track-ek szekció frissítése (ha van)
    const activeTracks = this.projectState.tracks.filter(t => t.status === 'active');
    const trackSection = `
### Aktív Fejlesztési Szálak
${activeTracks.map(t => `- **${t.name}** (${t.progress}%) - ${t.priority}`).join('\n')}
`;
    
    // Ha van "Aktív Fejlesztési Szálak" szekció, frissítjük
    const trackSectionRegex = /### Aktív Fejlesztési Szálak[\s\S]*?(?=###|---|\n## |\*{3}|$)/;
    if (trackSectionRegex.test(content)) {
      content = content.replace(trackSectionRegex, trackSection + '\n');
    }
    
    fs.writeFileSync(brunellaPath, content);
    
    return {
      success: true,
      message: 'Brunella.md frissítve',
      data: null
    };
  }

  /**
   * SUMMARY.md frissítése
   */
  private async updateSummaryFile(): Promise<AgentResult> {
    const content = `# 🎮 Conductor (Project Management) - SUMMARY

**Utolsó frissítés:** ${new Date().toISOString()}
**Generátor:** ProjectConductorAgent

Ez a mappa tartalmazza a Brunella projekt specifikáció-vezérelt fejlesztési keretrendszerének dokumentációit.

## 🗂️ Struktúra
- **\`tracks/\`**: Aktív és korábbi fejlesztési sávok
- **\`archive/\`**: Lezárt és archivált sávok

## 🛠️ Kulcsfájlok
- \`product.md\`: Termék jövőképe és funkciók
- \`tech-stack.md\`: Technológiai stack definíció
- \`workflow.md\`: Fejlesztési folyamat és protokollok
- \`tracks.md\`: Központi track regiszter
- \`product-guidelines.md\`: Stílus és minőségi irányelvek

## 📊 Jelenlegi Állapot
- **Aktív track-ek:** ${this.projectState.tracks.filter(t => t.status === 'active').length}
- **Lezárt track-ek:** ${this.projectState.tracks.filter(t => t.status === 'completed').length}
- **Egészségi állapot:** ${this.projectState.healthStatus.overall}

---
*Generálta: ProjectConductorAgent*
`;
    
    fs.writeFileSync(path.join(CONDUCTOR_PATH, 'SUMMARY.md'), content);
    
    return {
      success: true,
      message: 'SUMMARY.md frissítve',
      data: null
    };
  }

  // --------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // --------------------------------------------------------------------------

  private loadOrInitializeState(): ProjectState {
    if (fs.existsSync(STATE_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      } catch {
        logError(this.name, 'Állapot fájl sérült, újrainicializálás...');
      }
    }
    
    return {
      lastUpdated: new Date().toISOString(),
      tracks: [],
      components: [],
      recentChanges: [],
      healthStatus: {
        overall: 'unknown' as any,
        buildStatus: false,
        testStatus: false,
        documentationSync: false,
        lastHealthCheck: ''
      }
    };
  }

  private saveState(): void {
    this.projectState.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.projectState, null, 2));
  }

  private async refreshProjectState(): Promise<void> {
    // Komponensek frissítése
    this.projectState.components = MONITORED_DIRECTORIES.map(dir => {
      const fullPath = path.join(PROJECT_ROOT, dir);
      const exists = fs.existsSync(fullPath);
      return {
        name: dir.split('/').pop() || dir,
        path: dir,
        status: exists ? 'healthy' : 'error',
        lastModified: exists ? fs.statSync(fullPath).mtime.toISOString() : '',
        dependencies: []
      } as ComponentState;
    });
  }

  private addChangeEntry(type: ChangeEntry['type'], action: ChangeEntry['action'], path: string, description: string): void {
    this.projectState.recentChanges.unshift({
      timestamp: new Date().toISOString(),
      type,
      action,
      path,
      description
    });
    
    // Csak az utolsó 100 változást tartjuk meg
    if (this.projectState.recentChanges.length > 100) {
      this.projectState.recentChanges = this.projectState.recentChanges.slice(0, 100);
    }
  }

  private generateDirectoryTree(dir: string, depth: number, maxDepth: number): string {
    if (depth >= maxDepth) return '';
    
    const items = fs.readdirSync(dir).filter(item => 
      !item.startsWith('.') && 
      !['node_modules', 'build', '.venv', '__pycache__', '.git'].includes(item)
    );
    
    let tree = '';
    const indent = '│   '.repeat(depth);
    
    items.forEach((item, index) => {
      const isLast = index === items.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      const itemPath = path.join(dir, item);
      const isDir = fs.statSync(itemPath).isDirectory();
      
      tree += `${indent}${prefix}${item}${isDir ? '/' : ''}\n`;
      
      if (isDir && depth < maxDepth - 1) {
        tree += this.generateDirectoryTree(itemPath, depth + 1, maxDepth);
      }
    });
    
    return tree;
  }

  private extractTrackName(task: string): string {
    const match = task.match(/create\s+(?:track\s+)?["']?([^"']+)["']?/i);
    return match?.[1] || 'unnamed_track';
  }

  private extractTrackNameFromContent(content: string): string | null {
    const match = content.match(/^#\s*Track:\s*(.+)$/m);
    return match?.[1]?.trim() || null;
  }

  private parseStatus(status: string): TrackState['status'] {
    const map: Record<string, TrackState['status']> = {
      'proposed': 'proposed',
      'active': 'active',
      'in progress': 'active',
      'paused': 'paused',
      'completed': 'completed',
      'done': 'completed',
      'archived': 'archived'
    };
    return map[status.toLowerCase()] || 'active';
  }

  private parsePriority(priority: string): TrackState['priority'] {
    const map: Record<string, TrackState['priority']> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical'
    };
    return map[priority.toLowerCase()] || 'medium';
  }

  private getRecentChanges(): AgentResult {
    return {
      success: true,
      message: 'Legutóbbi változások',
      data: { changes: this.projectState.recentChanges.slice(0, 20) }
    };
  }

  private showHelp(): AgentResult {
    const helpText = `
# ProjectConductor Agent - Súgó

## Elérhető parancsok:

| Parancs | Leírás |
|---------|--------|
| \`status\` / \`állapot\` | Projekt státusz lekérdezése |
| \`sync\` / \`szinkron\` | Dokumentáció szinkronizálás |
| \`track create [név]\` | Új track létrehozása |
| \`track update\` | Track-ek frissítése |
| \`health\` | Health check futtatása |
| \`changes\` | Legutóbbi változások |
| \`tree\` / \`konyvtarfa\` | Könyvtárfa frissítése |
| \`full\` / \`teljes\` | Teljes projekt szinkronizálás |

## Példák:

\`\`\`
ProjectConductor status
ProjectConductor track create "Cloudflare Integration"
ProjectConductor sync
ProjectConductor full
\`\`\`
`;
    
    return {
      success: true,
      message: 'ProjectConductor súgó',
      data: { help: helpText }
    };
  }
}

export default ProjectConductorAgent;
