/**
 * Export D1 database to KV (compressed JSON)
 */
export async function exportD1ToKV(env) {
    const startTime = Date.now();
    const tables = [
        'edge_tasks',
        'edge_executions',
        'edge_results',
        'edge_fleet',
        'edge_workers',
        'edge_agents'
    ];
    const backup = {};
    let totalRows = 0;
    // Export each table
    for (const table of tables) {
        try {
            const result = await env.DB.prepare(`SELECT * FROM ${table}`).all();
            backup[table] = result.results || [];
            totalRows += result.results?.length || 0;
        }
        catch (error) {
            console.error(`Failed to export table ${table}:`, error);
            backup[table] = [];
        }
    }
    // Compress and store in KV
    const backupJson = JSON.stringify(backup);
    const size = new Blob([backupJson]).size;
    // Store latest backup + timestamped copy
    await Promise.all([
        env.KV.put('d1_backup_latest', backupJson, {
            metadata: {
                timestamp: Date.now(),
                rowsExported: totalRows,
                tables: tables.join(','),
                size
            }
        }),
        // Keep last 4 backups (1 hour history)
        env.KV.put(`d1_backup_${Date.now()}`, backupJson, {
            expirationTtl: 3600 // 1 hour
        })
    ]);
    const durationMs = Date.now() - startTime;
    return {
        timestamp: Date.now(),
        rowsExported: totalRows,
        tables,
        size,
        durationMs
    };
}
/**
 * Restore D1 from KV backup
 */
export async function restoreD1FromKV(env, backupKey = 'd1_backup_latest') {
    const startTime = Date.now();
    // Fetch backup from KV
    const backupJson = await env.KV.get(backupKey);
    if (!backupJson) {
        throw new Error(`No backup found at key: ${backupKey}`);
    }
    const backup = JSON.parse(backupJson);
    let totalRows = 0;
    // Restore each table
    for (const [table, rows] of Object.entries(backup)) {
        if (rows.length === 0)
            continue;
        try {
            // Clear existing table data
            await env.DB.prepare(`DELETE FROM ${table}`).run();
            // Batch insert (100 rows per batch to avoid timeout)
            for (let i = 0; i < rows.length; i += 100) {
                const batch = rows.slice(i, i + 100);
                const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');
                const values = [];
                for (const row of batch) {
                    const r = row;
                    values.push(r.id, r.agent_type || r.task_id, r.status || r.worker_name, r.payload || r.data_type, r.created_at, r.updated_at || r.completed_at, r.retry_count || 0, r.error_message || null);
                }
                await env.DB.prepare(`INSERT INTO ${table} VALUES ${placeholders}`).bind(...values).run();
                totalRows += batch.length;
            }
        }
        catch (error) {
            console.error(`Failed to restore table ${table}:`, error);
        }
    }
    const durationMs = Date.now() - startTime;
    return {
        timestamp: Date.now(),
        rowsExported: totalRows,
        tables: Object.keys(backup),
        size: new Blob([backupJson]).size,
        durationMs
    };
}
/**
 * List available backups in KV
 */
export async function listD1Backups(env) {
    const list = await env.KV.list({ prefix: 'd1_backup_' });
    return list.keys.map(k => ({
        key: k.name,
        metadata: k.metadata
    }));
}
/**
 * Verify backup integrity (quick check)
 */
export async function verifyBackupIntegrity(env, backupKey = 'd1_backup_latest') {
    const errors = [];
    const rowCounts = {};
    try {
        const backupJson = await env.KV.get(backupKey);
        if (!backupJson) {
            errors.push(`Backup not found: ${backupKey}`);
            return { valid: false, errors, rowCounts };
        }
        const backup = JSON.parse(backupJson);
        // Verify each table
        for (const [table, rows] of Object.entries(backup)) {
            if (!Array.isArray(rows)) {
                errors.push(`Invalid format for table ${table}: expected array`);
                continue;
            }
            rowCounts[table] = rows.length;
            // Verify first row has required fields
            if (rows.length > 0) {
                const first = rows[0];
                if (!first.id || !first.created_at) {
                    errors.push(`Missing required fields in table ${table}`);
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            rowCounts
        };
    }
    catch (error) {
        errors.push(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
        return { valid: false, errors, rowCounts };
    }
}
//# sourceMappingURL=backup.js.map