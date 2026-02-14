import { Router } from 'express';
import { evHunterHandler } from '../../tools/evHunterTool.js';
import path from 'path';
import fs from 'fs/promises';
import { logInfo, logError } from '../../utils/logger.js';

export function createEvHunterRouter(): Router {
    const router = Router();

    // Helper to find config path
    const getConfigPath = () => {
        // Priority 1: myai/agents/ev_hunter/config.json
        // const p1 = path.join(process.cwd(), 'myai', 'agents', 'ev_hunter', 'config.json');
        // Priority 2: external_research/ev_hunter_bot/config.json
        const p2 = path.join(process.cwd(), 'external_research', 'ev_hunter_bot', 'config.json');
        return p2; // Defaulting to p2 as per setup, logic could be improved to check existence
    };

    router.post('/run', async (req, res) => {
        try {
            const { mock, dryRun } = req.body;
            logInfo('API', `Triggering EV Hunter via API (mock=${mock}, dryRun=${dryRun})`);
            
            // Run async to not block response? 
            // Better to await it so client knows result.
            const result = await evHunterHandler({ mock, dryRun });
            
            if (result.isError) {
                res.status(500).json(result);
            } else {
                res.json(result);
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

    return router;
}