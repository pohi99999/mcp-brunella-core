/**
 * PredictiveIntelligence — Proactive business intelligence module
 * 
 * Monitors agent activity patterns, detects anomalies, and generates
 * proactive alerts and recommendations before problems occur.
 * 
 * Capabilities:
 * - Activity pattern tracking (interaction frequency, task completion rates)
 * - Anomaly detection (drops in activity, error spikes)
 * - Churn risk detection (declining engagement)
 * - Proactive recommendation generation
 * - Scheduled health assessments
 */

import { logInfo, logWarn } from '../utils/logger.js';
import { getGlobalDb } from '../utils/globalDb.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActivitySignal {
  source: string;           // agent, user, system
  action: string;           // task_completed, error, interaction, delegation
  value: number;            // quantity/duration
  tags: string[];
  timestamp: number;
}

export interface PredictiveAlert {
  id: string;
  type: 'churn_risk' | 'error_spike' | 'performance_drop' | 'opportunity' | 'recommendation';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestedAction: string;
  confidence: number;       // 0-1
  data: Record<string, unknown>;
  createdAt: number;
  acknowledged: boolean;
}

export interface ActivityPattern {
  source: string;
  avgDaily: number;
  trend: 'rising' | 'stable' | 'declining';
  lastActivity: number;
  totalActions: number;
}

interface PredictiveAlertRow {
  id: string;
  type: PredictiveAlert['type'];
  severity: PredictiveAlert['severity'];
  title: string;
  description: string;
  suggested_action: string;
  confidence: number;
  data: string;
  created_at: number;
  acknowledged: number;
}

// ─── Predictive Intelligence Engine ──────────────────────────────────────────

export class PredictiveIntelligence {
  private static instance: PredictiveIntelligence | null = null;
  private signals: ActivitySignal[] = [];
  private alerts = new Map<string, PredictiveAlert>();
  private alertCounter = 0;
  private initialized = false;

  static getInstance(): PredictiveIntelligence {
    if (!PredictiveIntelligence.instance) {
      PredictiveIntelligence.instance = new PredictiveIntelligence();
    }
    return PredictiveIntelligence.instance;
  }

  /** Initialize persistence */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const db = getGlobalDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS activity_signals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          action TEXT NOT NULL,
          value REAL DEFAULT 1,
          tags TEXT DEFAULT '[]',
          timestamp INTEGER DEFAULT (strftime('%s','now') * 1000)
        );
        CREATE TABLE IF NOT EXISTS predictive_alerts (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          severity TEXT DEFAULT 'low',
          title TEXT NOT NULL,
          description TEXT,
          suggested_action TEXT,
          confidence REAL DEFAULT 0.5,
          data TEXT DEFAULT '{}',
          created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
          acknowledged INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_signals_source ON activity_signals(source);
        CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON activity_signals(timestamp);
        CREATE INDEX IF NOT EXISTS idx_alerts_type ON predictive_alerts(type);
      `);
      this.initialized = true;
      logInfo('PredictiveIntelligence', 'Initialized');
    } catch (err) {
      logWarn('PredictiveIntelligence', `Init failed: ${err instanceof Error ? err.message : String(err)}`);
      this.initialized = true;
    }
  }

  /** Record an activity signal */
  async recordSignal(signal: Omit<ActivitySignal, 'timestamp'>): Promise<void> {
    await this.init();
    const full: ActivitySignal = { ...signal, timestamp: Date.now() };
    this.signals.push(full);

    // Keep in-memory buffer manageable
    if (this.signals.length > 2000) {
      this.signals.splice(0, this.signals.length - 2000);
    }

    // Persist
    try {
      const db = getGlobalDb();
      db.prepare(
        'INSERT INTO activity_signals (source, action, value, tags, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).run(full.source, full.action, full.value, JSON.stringify(full.tags), full.timestamp);
    } catch { /* best-effort persistence */ }
  }

  /**
   * Run predictive analysis — detects anomalies and generates alerts.
   * Should be called periodically (e.g., every 5 minutes or after N interactions).
   */
  async analyze(): Promise<PredictiveAlert[]> {
    await this.init();
    const newAlerts: PredictiveAlert[] = [];
    const now = Date.now();

    // 1. Error spike detection (last hour vs previous hour)
    const lastHour = this.signals.filter(s => s.action === 'error' && s.timestamp > now - 3600000);
    const prevHour = this.signals.filter(s => s.action === 'error' && s.timestamp > now - 7200000 && s.timestamp <= now - 3600000);

    if (lastHour.length >= 5 && lastHour.length > prevHour.length * 2) {
      newAlerts.push(this.createAlert(
        'error_spike',
        'high',
        'Hiba-csúcs észlelve!',
        `Az elmúlt órában ${lastHour.length} hiba történt, ami ${prevHour.length > 0 ? ((lastHour.length / prevHour.length) * 100).toFixed(0) : '∞'}%-kal több az előző óránál.`,
        'Ellenőrizd a rendszer állapotát és a hibalogokat',
        0.85,
        { lastHourErrors: lastHour.length, prevHourErrors: prevHour.length },
      ));
    }

    // 2. Performance degradation (avg task duration trending up)
    const completions = this.signals.filter(s => s.action === 'task_completed' && s.timestamp > now - 3600000);
    if (completions.length >= 5) {
      const firstHalf = completions.slice(0, Math.floor(completions.length / 2));
      const secondHalf = completions.slice(Math.floor(completions.length / 2));
      const avgFirst = firstHalf.reduce((s, c) => s + c.value, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, c) => s + c.value, 0) / secondHalf.length;

      if (avgSecond > avgFirst * 1.5 && avgSecond > 5000) {
        newAlerts.push(this.createAlert(
          'performance_drop',
          'medium',
          'Teljesítmény romlás',
          `Az átlagos feladat végrehajtási idő ${(avgFirst / 1000).toFixed(1)}s → ${(avgSecond / 1000).toFixed(1)}s-ra nőtt.`,
          'Vizsgáld meg a rendszer terhelését és az ágens hatékonyságát',
          0.7,
          { avgFirst, avgSecond },
        ));
      }
    }

    // 3. Inactivity detection (churn risk)
    const patterns = this.getActivityPatterns();
    for (const pattern of patterns) {
      if (pattern.trend === 'declining' && pattern.lastActivity < now - 86400000) { // >24h inactive
        newAlerts.push(this.createAlert(
          'churn_risk',
          'medium',
          `${pattern.source} inaktív`,
          `${pattern.source} már ${Math.floor((now - pattern.lastActivity) / 3600000)} órája nem aktív. Trend: csökkenő.`,
          `Ellenőrizd ${pattern.source} állapotát vagy indíts újra`,
          0.6,
          { source: pattern.source, lastActivity: pattern.lastActivity, avgDaily: pattern.avgDaily },
        ));
      }
    }

    // 4. Opportunity detection (high success rate agent)
    const agentSuccesses = new Map<string, { success: number; total: number }>();
    const recentActions = this.signals.filter(s =>
      (s.action === 'task_completed' || s.action === 'error') && s.timestamp > now - 86400000
    );
    for (const sig of recentActions) {
      const entry = agentSuccesses.get(sig.source) ?? { success: 0, total: 0 };
      entry.total++;
      if (sig.action === 'task_completed') entry.success++;
      agentSuccesses.set(sig.source, entry);
    }

    for (const [agent, stats] of agentSuccesses) {
      if (stats.total >= 10 && stats.success / stats.total > 0.95) {
        newAlerts.push(this.createAlert(
          'opportunity',
          'low',
          `${agent} kiválóan teljesít`,
          `${agent}: ${stats.success}/${stats.total} sikeres (${((stats.success / stats.total) * 100).toFixed(0)}%). Érdemes több feladatot delegálni neki.`,
          `Növeld ${agent} feladat-prioritását`,
          0.8,
          { agent, successRate: stats.success / stats.total, total: stats.total },
        ));
      }
    }

    // Persist new alerts
    for (const alert of newAlerts) {
      this.alerts.set(alert.id, alert);
      this.persistAlert(alert);
    }

    if (newAlerts.length > 0) {
      logInfo('PredictiveIntelligence', `Generated ${newAlerts.length} alert(s): ${newAlerts.map(a => a.title).join(', ')}`);
    }

    return newAlerts;
  }

  /** Get activity patterns for all sources */
  getActivityPatterns(): ActivityPattern[] {
    const now = Date.now();
    const dayMs = 86400000;
    const sourceMap = new Map<string, ActivitySignal[]>();

    for (const sig of this.signals) {
      const list = sourceMap.get(sig.source) ?? [];
      list.push(sig);
      sourceMap.set(sig.source, list);
    }

    const patterns: ActivityPattern[] = [];
    for (const [source, signals] of sourceMap) {
      const last7d = signals.filter(s => s.timestamp > now - 7 * dayMs);
      const last3d = signals.filter(s => s.timestamp > now - 3 * dayMs);
      const prev3d = signals.filter(s => s.timestamp > now - 6 * dayMs && s.timestamp <= now - 3 * dayMs);

      const avgDaily = last7d.length / 7;
      const recent = last3d.length / 3;
      const previous = prev3d.length / 3;

      let trend: 'rising' | 'stable' | 'declining' = 'stable';
      if (previous > 0) {
        const ratio = recent / previous;
        if (ratio > 1.3) trend = 'rising';
        else if (ratio < 0.7) trend = 'declining';
      }

      patterns.push({
        source,
        avgDaily,
        trend,
        lastActivity: signals[signals.length - 1]?.timestamp ?? 0,
        totalActions: signals.length,
      });
    }

    return patterns.sort((a, b) => b.totalActions - a.totalActions);
  }

  /** Get active (unacknowledged) alerts */
  getActiveAlerts(): PredictiveAlert[] {
    return this.listAlerts({ acknowledged: false })
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      });
  }

  listAlerts(options: { acknowledged?: boolean; limit?: number } = {}): PredictiveAlert[] {
    void this.init();

    try {
      const db = getGlobalDb();
      const limit = Math.max(1, Math.trunc(options.limit ?? 25));
      const where: string[] = [];
      const values: Array<number> = [];

      if (typeof options.acknowledged === 'boolean') {
        where.push('acknowledged = ?');
        values.push(options.acknowledged ? 1 : 0);
      }

      const rows = db.prepare(`
        SELECT *
        FROM predictive_alerts
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT ?
      `).all(...values, limit) as PredictiveAlertRow[];

      return rows.map((row) => {
        const alert = mapAlertRow(row);
        this.alerts.set(alert.id, alert);
        return alert;
      });
    } catch {
      return Array.from(this.alerts.values())
        .filter((alert) => typeof options.acknowledged === 'boolean' ? alert.acknowledged === options.acknowledged : true)
        .slice(0, options.limit ?? 25);
    }
  }

  getAlert(alertId: string): PredictiveAlert | null {
    const cached = this.alerts.get(alertId);
    if (cached) {
      return cached;
    }

    void this.init();
    try {
      const db = getGlobalDb();
      const row = db.prepare('SELECT * FROM predictive_alerts WHERE id = ?').get(alertId) as PredictiveAlertRow | undefined;
      if (!row) {
        return null;
      }
      const alert = mapAlertRow(row);
      this.alerts.set(alert.id, alert);
      return alert;
    } catch {
      return null;
    }
  }

  /** Acknowledge an alert */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.getAlert(alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    this.alerts.set(alert.id, alert);
    try {
      const db = getGlobalDb();
      db.prepare('UPDATE predictive_alerts SET acknowledged = 1 WHERE id = ?').run(alertId);
    } catch { /* best-effort */ }
    return true;
  }

  unacknowledgeAlert(alertId: string): boolean {
    const alert = this.getAlert(alertId);
    if (!alert) return false;
    alert.acknowledged = false;
    this.alerts.set(alert.id, alert);
    try {
      const db = getGlobalDb();
      db.prepare('UPDATE predictive_alerts SET acknowledged = 0 WHERE id = ?').run(alertId);
    } catch { /* best-effort */ }
    return true;
  }

  /**
   * Get predictive context for system prompt enrichment.
   */
  getPredictiveContext(): string {
    const activeAlerts = this.getActiveAlerts();
    if (activeAlerts.length === 0) return '';

    const alertsSummary = activeAlerts
      .slice(0, 3)
      .map(a => `[${a.severity.toUpperCase()}] ${a.title}: ${a.suggestedAction}`)
      .join('\n');

    return `\n🔮 Prediktív figyelmeztetések:\n${alertsSummary}`;
  }

  /** Get stats */
  getStats(): { signals: number; alerts: number; activeAlerts: number; patterns: number } {
    const alerts = this.listAlerts({ limit: 500 });
    return {
      signals: this.signals.length,
      alerts: alerts.length,
      activeAlerts: this.getActiveAlerts().length,
      patterns: this.getActivityPatterns().length,
    };
  }

  private createAlert(
    type: PredictiveAlert['type'],
    severity: PredictiveAlert['severity'],
    title: string,
    description: string,
    suggestedAction: string,
    confidence: number,
    data: Record<string, unknown>,
  ): PredictiveAlert {
    return {
      id: `pa-${++this.alertCounter}-${Date.now()}`,
      type,
      severity,
      title,
      description,
      suggestedAction,
      confidence,
      data,
      createdAt: Date.now(),
      acknowledged: false,
    };
  }

  private persistAlert(alert: PredictiveAlert): void {
    try {
      const db = getGlobalDb();
      db.prepare(`
        INSERT OR REPLACE INTO predictive_alerts (id, type, severity, title, description, suggested_action, confidence, data, created_at, acknowledged)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(alert.id, alert.type, alert.severity, alert.title, alert.description,
        alert.suggestedAction, alert.confidence, JSON.stringify(alert.data),
        alert.createdAt, alert.acknowledged ? 1 : 0);
    } catch { /* best-effort */ }
  }
}

function mapAlertRow(row: PredictiveAlertRow): PredictiveAlert {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    suggestedAction: row.suggested_action,
    confidence: Number(row.confidence ?? 0),
    data: JSON.parse(row.data || '{}') as Record<string, unknown>,
    createdAt: Number(row.created_at ?? 0),
    acknowledged: Boolean(row.acknowledged),
  };
}
