import { Router } from 'express';
import { evHunterHandler } from '@packages/utils/evHunterTool.js';
import path from 'path';
import fs from 'fs/promises';
import { logInfo, logError } from '@packages/utils/logger.js';
import { kvCache } from '@packages/utils/kvCache.js';

export function createEvHunterRouter(): Router {
    const router = Router();

    // Helper to find config path
    const getConfigPath = () => {
        // Priority 2: external_research/ev_hunter_bot/config.json
        const p2 = path.join(process.cwd(), 'external_research', 'ev_hunter_bot', 'config.json');
        return p2; // Defaulting to p2 as per setup, logic could be improved to check existence
    };

    router.post('/run', async (req, res) => {
        try {
            const { mock, dryRun, useCache = true } = req.body;
            logInfo('API', `Triggering EV Hunter via API (mock=${mock}, dryRun=${dryRun}, useCache=${useCache})`);
            
            // Generate cache key based on search parameters
            const cacheKey = `evhunter:results:${mock ? 'mock' : 'live'}:${dryRun ? 'dry' : 'real'}`;
            
            // If useCache is enabled, try to get from cache first
            if (useCache) {
                try {
                    const result = await kvCache.getOrCompute(
                        cacheKey,
                        async () => {
                            logInfo('EV Hunter', 'Cache miss, running EV Hunter search...');
                            return await evHunterHandler({ mock, dryRun });
                        },
                        3600 // Cache for 1 hour (EV listings don't change that frequently)
                    );
                    
                    if (result.isError) {
                        res.status(500).json(result);
                    } else {
                        res.json({ ...result, cached: true });
                    }
                } catch (cacheError: unknown) {
                    const msg = cacheError instanceof Error ? cacheError.message : String(cacheError);
                    logError('API', `Cache error, falling back to fresh run: ${msg}`);
                    
                    // Fallback to direct run if cache fails
                    const result = await evHunterHandler({ mock, dryRun });
                    if (result.isError) {
                        res.status(500).json(result);
                    } else {
                        res.json({ ...result, cached: false });
                    }
                }
            } else {
                // Direct run without cache
                const result = await evHunterHandler({ mock, dryRun });
                if (result.isError) {
                    res.status(500).json(result);
                } else {
                    res.json({ ...result, cached: false });
                }
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('API', `EV Hunter API error: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/config', async (req, res) => {
        try {
            const configPath = getConfigPath();
            const content = await fs.readFile(configPath, 'utf-8');
            res.json(JSON.parse(content));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: `Failed to read config: ${msg}` });
        }
    });

    router.get('/cache/status', async (req, res) => {
        try {
            const status = kvCache.status();
            res.json({
                ...status,
                prefix: 'evhunter:',
                description: 'EV Hunter results cache status'
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: `Failed to get cache status: ${msg}` });
        }
    });

    router.post('/cache/invalidate', async (req, res) => {
        try {
            await kvCache.invalidateByPrefix('evhunter:');
            logInfo('API', 'EV Hunter cache invalidated');
            res.json({ success: true, message: 'EV Hunter cache invalidated' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('API', `Cache invalidation error: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}