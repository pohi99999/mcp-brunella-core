/**
 * D1 Database Storage Layer for Grant Monitor
 * Handles all database operations for storing and retrieving grants
 */

import { Grant, D1Result, GrantSearchQuery, GrantFeedItem } from '../types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('D1Storage');

export class GrantD1Storage {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Initialize database schema (idempotent)
   */
  async initialize(): Promise<D1Result<void>> {
    try {
      logger.info('Initializing D1 schema for grants');

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS grants (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          agency TEXT NOT NULL,
          description TEXT,
          funding_amount REAL,
          deadline TEXT,
          url TEXT UNIQUE,
          source TEXT DEFAULT 'custom',
          discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          category TEXT,
          eligibility TEXT,
          tags TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_grants_deadline ON grants(deadline);
        CREATE INDEX IF NOT EXISTS idx_grants_agency ON grants(agency);
        CREATE INDEX IF NOT EXISTS idx_grants_source ON grants(source);
        CREATE INDEX IF NOT EXISTS idx_grants_category ON grants(category);

        CREATE TABLE IF NOT EXISTS grant_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          grants_found INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_grant_checks_source ON grant_checks(source);
      `);

      logger.info('✅ D1 schema initialized successfully');
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize D1 schema', error);
      return { success: false, error: msg };
    }
  }

  /**
   * Store a single grant in D1
   */
  async storeGrant(grant: Grant): Promise<D1Result<string>> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO grants (
          id, title, agency, description, funding_amount, 
          deadline, url, source, discovered_at, category, eligibility, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = CURRENT_TIMESTAMP,
          title = excluded.title,
          description = excluded.description,
          funding_amount = excluded.funding_amount,
          deadline = excluded.deadline
      `);

      await stmt.bind(
        grant.id,
        grant.title,
        grant.agency,
        grant.description,
        grant.fundingAmount,
        grant.deadline,
        grant.url,
        grant.source,
        grant.discoveredAt,
        grant.category,
        JSON.stringify(grant.eligibility),
        JSON.stringify(grant.tags)
      ).run();

      logger.debug(`Grant stored: ${grant.id}`);
      return { success: true, data: grant.id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to store grant ${grant.id}`, error);
      return { success: false, error: msg };
    }
  }

  /**
   * Store multiple grants in batch
   */
  async storeGrantsBatch(grants: Grant[]): Promise<D1Result<number>> {
    try {
      let successCount = 0;

      for (const grant of grants) {
        const result = await this.storeGrant(grant);
        if (result.success) successCount++;
      }

      logger.info(`Batch store complete: ${successCount}/${grants.length} grants stored`);
      return { success: true, data: successCount };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Batch store failed', error);
      return { success: false, error: msg };
    }
  }

  /**
   * Search grants by query parameters
   */
  async searchGrants(query: GrantSearchQuery): Promise<D1Result<Grant[]>> {
    try {
      let sql = 'SELECT * FROM grants WHERE 1=1';
      const params: any[] = [];

      if (query.keyword) {
        sql += ' AND (title LIKE ? OR description LIKE ?)';
        const keyword = `%${query.keyword}%`;
        params.push(keyword, keyword);
      }

      if (query.agency) {
        sql += ' AND agency = ?';
        params.push(query.agency);
      }

      if (query.minAmount !== undefined) {
        sql += ' AND funding_amount >= ?';
        params.push(query.minAmount);
      }

      if (query.maxAmount !== undefined) {
        sql += ' AND funding_amount <= ?';
        params.push(query.maxAmount);
      }

      if (query.category) {
        sql += ' AND category = ?';
        params.push(query.category);
      }

      sql += ' ORDER BY deadline ASC';

      if (query.limit) {
        sql += ` LIMIT ${query.limit}`;
      }

      if (query.offset) {
        sql += ` OFFSET ${query.offset}`;
      }

      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).all();

      logger.debug(`Found ${result.results?.length || 0} grants matching query`);
      return { success: true, results: result.results || [] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Search grants failed', error);
      return { success: false, error: msg };
    }
  }

  /**
   * Get upcoming grants (within 30 days)
   */
  async getUpcomingGrants(limit: number = 10): Promise<D1Result<GrantFeedItem[]>> {
    try {
      const sql = `
        SELECT 
          id as grantId,
          title,
          deadline,
          funding_amount as fundingAmount,
          1.0 as relevanceScore
        FROM grants
        WHERE deadline > CURRENT_TIMESTAMP
        AND deadline <= datetime('now', '+30 days')
        ORDER BY deadline ASC
        LIMIT ?
      `;

      const result = await this.db.prepare(sql).bind(limit).all();

      logger.debug(`Found ${result.results?.length || 0} upcoming grants`);
      return { success: true, results: result.results || [] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Get upcoming grants failed', error);
      return { success: false, error: msg };
    }
  }

  /**
   * Record a grant check
   */
  async recordGrantCheck(source: string, grantsFound: number, error?: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO grant_checks (source, grants_found, error_message)
        VALUES (?, ?, ?)
      `);

      await stmt.bind(source, grantsFound, error || null).run();
      logger.info(`Grant check recorded: ${source} - ${grantsFound} grants`);
    } catch (error) {
      logger.error(`Failed to record grant check for ${source}`, error);
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<D1Result<{
    totalGrants: number;
    agencies: string[];
    sources: string[];
    upcomingDeadlines: number;
  }>> {
    try {
      const statsResult = await this.db
        .prepare(
          `SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT agency) as agency_count,
            COUNT(DISTINCT source) as source_count,
            COUNT(CASE WHEN deadline > CURRENT_TIMESTAMP THEN 1 END) as upcoming
           FROM grants`
        )
        .first();

      const agenciesResult = await this.db
        .prepare('SELECT DISTINCT agency FROM grants')
        .all();

      const sourcesResult = await this.db
        .prepare('SELECT DISTINCT source FROM grants')
        .all();

      return {
        success: true,
        data: {
          totalGrants: (statsResult as any)?.total || 0,
          agencies: (agenciesResult.results as any[] || []).map((r: any) => r.agency) || [],
          sources: (sourcesResult.results as any[] || []).map((r: any) => r.source) || [],
          upcomingDeadlines: (statsResult as any)?.upcoming || 0,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Get stats failed', error);
      return { success: false, error: msg };
    }
  }
}
