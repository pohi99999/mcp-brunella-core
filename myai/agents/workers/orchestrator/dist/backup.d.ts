import { Env } from './types';
/**
 * D1 Backup to KV (Phase 6.2 DR Improvement)
 *
 * Purpose: Export D1 database to KV every 15 minutes for RPO improvement
 * - Current RPO: 30 minutes (Cloudflare automated backups)
 * - Target RPO: 5 minutes
 * - This reduces RPO to 15 minutes (interim solution until dual-database replication)
 *
 * Scheduled via Cron Trigger (every 15 minutes)
 */
export interface D1BackupMetadata {
    timestamp: number;
    rowsExported: number;
    tables: string[];
    size: number;
    durationMs: number;
}
/**
 * Export D1 database to KV (compressed JSON)
 */
export declare function exportD1ToKV(env: Env): Promise<D1BackupMetadata>;
/**
 * Restore D1 from KV backup
 */
export declare function restoreD1FromKV(env: Env, backupKey?: string): Promise<D1BackupMetadata>;
/**
 * List available backups in KV
 */
export declare function listD1Backups(env: Env): Promise<Array<{
    key: string;
    metadata: unknown;
}>>;
/**
 * Verify backup integrity (quick check)
 */
export declare function verifyBackupIntegrity(env: Env, backupKey?: string): Promise<{
    valid: boolean;
    errors: string[];
    rowCounts: Record<string, number>;
}>;
//# sourceMappingURL=backup.d.ts.map