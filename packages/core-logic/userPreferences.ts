/**
 * User Preferences — Mem0-szerű hosszú távú felhasználói preferencia réteg.
 *
 * Három memória típus (Mem0 koncepció alapján):
 * - episodic: Munkamenet-specifikus események (automatikusan törlődnek)
 * - semantic: Kinyert tények és tudásdarabkok (hosszú távú)
 * - procedural: Megtanult eljárások és minták (agent-specifikus)
 *
 * SQLite-alapú, a StructuredMemory mellé épül.
 */

import Database from "better-sqlite3";
import path from "path";
import { config } from "@packages/utils/index.js";
import { logInfo, logError } from "@packages/utils/logger.js";

const COMPONENT = "UserPreferences";

// ── Típusok ─────────────────────────────────────────────────────────

export type MemoryType = "episodic" | "semantic" | "procedural";

export interface UserPreference {
  id?: number;
  user_id: string;
  key: string;
  value: string;
  memory_type: MemoryType;
  category: string;
  confidence: number;
  source_agent: string;
  metadata_json: string;
  created_at?: string;
  updated_at?: string;
  expires_at?: string | null;
  access_count?: number;
}

export interface PreferenceQuery {
  user_id: string;
  memory_type?: MemoryType;
  category?: string;
  key?: string;
  limit?: number;
  min_confidence?: number;
}

export interface PreferenceStats {
  total: number;
  by_type: Record<MemoryType, number>;
  by_category: Record<string, number>;
  top_accessed: Array<{ key: string; access_count: number }>;
}

// ── Adatbázis ───────────────────────────────────────────────────────

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const dbDir = path.join(config.workspaceRoot, "data");
  const dbPath = path.join(dbDir, "brunella.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}

export function initSchema(database?: Database.Database): void {
  const d = database ?? db;
  if (!d) throw new Error('userPreferences: database not initialized — call getDb() first');
  d.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      memory_type TEXT NOT NULL DEFAULT 'semantic'
        CHECK(memory_type IN ('episodic', 'semantic', 'procedural')),
      category TEXT NOT NULL DEFAULT 'general',
      confidence REAL NOT NULL DEFAULT 0.8,
      source_agent TEXT NOT NULL DEFAULT 'system',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      access_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      UNIQUE(user_id, key, memory_type)
    );

    CREATE INDEX IF NOT EXISTS idx_uprefs_user_type
      ON user_preferences(user_id, memory_type);
    CREATE INDEX IF NOT EXISTS idx_uprefs_user_category
      ON user_preferences(user_id, category);
    CREATE INDEX IF NOT EXISTS idx_uprefs_expires
      ON user_preferences(expires_at);
  `);

  logInfo(COMPONENT, "User preferences tábla inicializálva");
}

// ── CRUD műveletek ──────────────────────────────────────────────────

/**
 * Preferencia mentése vagy frissítése (UPSERT).
 */
export function savePreference(pref: Omit<UserPreference, "id" | "created_at" | "updated_at" | "access_count">): UserPreference {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO user_preferences (user_id, key, value, memory_type, category, confidence, source_agent, metadata_json, expires_at)
    VALUES (@user_id, @key, @value, @memory_type, @category, @confidence, @source_agent, @metadata_json, @expires_at)
    ON CONFLICT(user_id, key, memory_type)
    DO UPDATE SET
      value = excluded.value,
      category = excluded.category,
      confidence = excluded.confidence,
      source_agent = excluded.source_agent,
      metadata_json = excluded.metadata_json,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `);

  const params = {
    user_id: pref.user_id || "default",
    key: pref.key,
    value: pref.value,
    memory_type: pref.memory_type || "semantic",
    category: pref.category || "general",
    confidence: pref.confidence ?? 0.8,
    source_agent: pref.source_agent || "system",
    metadata_json: pref.metadata_json || "{}",
    expires_at: pref.expires_at ?? null,
  };

  stmt.run(params);

  const row = d.prepare(
    "SELECT * FROM user_preferences WHERE user_id = ? AND key = ? AND memory_type = ?"
  ).get(params.user_id, params.key, params.memory_type) as UserPreference;

  logInfo(COMPONENT, `Preferencia mentve: [${params.memory_type}] ${params.key}`);
  return row;
}

/**
 * Preferenciák lekérdezése szűrőkkel.
 */
export function queryPreferences(query: PreferenceQuery): UserPreference[] {
  const d = getDb();
  const conditions: string[] = ["user_id = @user_id"];
  const params: Record<string, unknown> = { user_id: query.user_id };

  if (query.memory_type) {
    conditions.push("memory_type = @memory_type");
    params.memory_type = query.memory_type;
  }
  if (query.category) {
    conditions.push("category = @category");
    params.category = query.category;
  }
  if (query.key) {
    conditions.push("key LIKE @key");
    params.key = `%${query.key}%`;
  }
  if (query.min_confidence) {
    conditions.push("confidence >= @min_confidence");
    params.min_confidence = query.min_confidence;
  }

  // Lejárt bejegyzések kiszűrése
  conditions.push("(expires_at IS NULL OR expires_at > datetime('now'))");

  const sql = `
    SELECT * FROM user_preferences
    WHERE ${conditions.join(" AND ")}
    ORDER BY confidence DESC, updated_at DESC
    LIMIT @limit
  `;
  params.limit = query.limit || 50;

  const rows = d.prepare(sql).all(params) as UserPreference[];

  // Access count növelése a lekérdezett soroknál
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length > 0) {
      d.prepare(
        `UPDATE user_preferences SET access_count = access_count + 1 WHERE id IN (${ids.join(",")})`
      ).run();
    }
  }

  return rows;
}

/**
 * Összes preferencia lekérése egy felhasználóhoz, típus szerint csoportosítva.
 * Az Orchestrator promptba injektáláshoz — kompakt formátum.
 */
export function getPreferenceContext(userId: string): string {
  const prefs = queryPreferences({ user_id: userId, min_confidence: 0.5 });

  if (prefs.length === 0) return "";

  const grouped: Record<MemoryType, UserPreference[]> = {
    episodic: [],
    semantic: [],
    procedural: [],
  };

  for (const p of prefs) {
    grouped[p.memory_type].push(p);
  }

  const lines: string[] = ["[Felhasználói preferenciák]"];

  if (grouped.semantic.length > 0) {
    lines.push("Tények:");
    for (const p of grouped.semantic.slice(0, 10)) {
      lines.push(`  - ${p.key}: ${p.value}`);
    }
  }

  if (grouped.procedural.length > 0) {
    lines.push("Eljárások:");
    for (const p of grouped.procedural.slice(0, 5)) {
      lines.push(`  - ${p.key}: ${p.value}`);
    }
  }

  if (grouped.episodic.length > 0) {
    lines.push("Aktuális kontextus:");
    for (const p of grouped.episodic.slice(0, 5)) {
      lines.push(`  - ${p.key}: ${p.value}`);
    }
  }

  return lines.join("\n");
}

/**
 * Preferencia törlése.
 */
export function deletePreference(userId: string, key: string, memoryType?: MemoryType): boolean {
  const d = getDb();
  let sql = "DELETE FROM user_preferences WHERE user_id = ? AND key = ?";
  const params: unknown[] = [userId, key];

  if (memoryType) {
    sql += " AND memory_type = ?";
    params.push(memoryType);
  }

  const result = d.prepare(sql).run(...params);
  return (result.changes ?? 0) > 0;
}

/**
 * Lejárt preferenciák törlése.
 */
export function purgeExpiredPreferences(): number {
  const d = getDb();
  const result = d.prepare(
    "DELETE FROM user_preferences WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')"
  ).run();
  const count = result.changes ?? 0;
  if (count > 0) {
    logInfo(COMPONENT, `${count} lejárt preferencia törölve`);
  }
  return count;
}

/**
 * Statisztikák a preferencia rendszerről.
 */
export function getPreferenceStats(userId: string): PreferenceStats {
  const d = getDb();

  const total = (d.prepare(
    "SELECT COUNT(*) as cnt FROM user_preferences WHERE user_id = ?"
  ).get(userId) as { cnt: number }).cnt;

  const byTypeRows = d.prepare(
    "SELECT memory_type, COUNT(*) as cnt FROM user_preferences WHERE user_id = ? GROUP BY memory_type"
  ).all(userId) as Array<{ memory_type: MemoryType; cnt: number }>;

  const by_type: Record<MemoryType, number> = { episodic: 0, semantic: 0, procedural: 0 };
  for (const row of byTypeRows) {
    by_type[row.memory_type] = row.cnt;
  }

  const byCatRows = d.prepare(
    "SELECT category, COUNT(*) as cnt FROM user_preferences WHERE user_id = ? GROUP BY category ORDER BY cnt DESC LIMIT 10"
  ).all(userId) as Array<{ category: string; cnt: number }>;

  const by_category: Record<string, number> = {};
  for (const row of byCatRows) {
    by_category[row.category] = row.cnt;
  }

  const topAccessed = d.prepare(
    "SELECT key, access_count FROM user_preferences WHERE user_id = ? ORDER BY access_count DESC LIMIT 5"
  ).all(userId) as Array<{ key: string; access_count: number }>;

  return { total, by_type, by_category, top_accessed: topAccessed };
}

/**
 * Adatbázis kapcsolat lezárása (teszteléshez).
 */
export function closePreferenceDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

