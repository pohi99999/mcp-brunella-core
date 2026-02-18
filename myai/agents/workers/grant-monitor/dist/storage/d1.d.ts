/**
 * D1 Database Storage Layer for Grant Monitor
 * Handles all database operations for storing and retrieving grants
 */
import { Grant, D1Result, GrantSearchQuery, GrantFeedItem } from '../types.js';
export declare class GrantD1Storage {
    private db;
    constructor(db: any);
    /**
     * Initialize database schema (idempotent)
     */
    initialize(): Promise<D1Result<void>>;
    /**
     * Store a single grant in D1
     */
    storeGrant(grant: Grant): Promise<D1Result<string>>;
    /**
     * Store multiple grants in batch
     */
    storeGrantsBatch(grants: Grant[]): Promise<D1Result<number>>;
    /**
     * Search grants by query parameters
     */
    searchGrants(query: GrantSearchQuery): Promise<D1Result<Grant[]>>;
    /**
     * Get upcoming grants (within 30 days)
     */
    getUpcomingGrants(limit?: number): Promise<D1Result<GrantFeedItem[]>>;
    /**
     * Record a grant check
     */
    recordGrantCheck(source: string, grantsFound: number, error?: string): Promise<void>;
    /**
     * Get statistics
     */
    getStats(): Promise<D1Result<{
        totalGrants: number;
        agencies: string[];
        sources: string[];
        upcomingDeadlines: number;
    }>>;
}
