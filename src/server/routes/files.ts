import { Router } from 'express';

export function createFileRoutes(): Router {
    const router = Router();

    router.get('/list', async (req, res) => {
        try {
            const { default: path } = await import('path');
            const fs = await import('fs');

            const relPath = req.query.path as string || '.';
            if (relPath.includes('..')) {
                res.status(400).json({ error: 'Invalid path' });
                return;
            }

            const fullPath = path.resolve(process.cwd(), relPath);
            if (!fullPath.startsWith(process.cwd())) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });

            // Batched async processing to avoid blocking event loop
            const files: Array<{
                name: string;
                isDirectory: boolean;
                path: string;
                size: number;
                modified: Date;
            }> = [];
            const BATCH_SIZE = 50;

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const batch = entries.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.all(batch.map(async entry => {
                    const stats = await fs.promises.stat(path.join(fullPath, entry.name));
                    return {
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                        path: path.join(relPath, entry.name).replace(/\\/g, '/'),
                        size: entry.isFile() ? stats.size : 0,
                        modified: stats.mtime
                    };
                }));
                files.push(...batchResults);
            }

            res.json({ files });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/content', async (req, res) => {
        try {
            const { default: path } = await import('path');
            const fs = await import('fs');

            const filePath = req.query.path as string;
            if (!filePath || filePath.includes('..')) {
                res.status(400).json({ error: 'Invalid path' });
                return;
            }

            const fullPath = path.resolve(process.cwd(), filePath);
            if (!fullPath.startsWith(process.cwd())) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const content = await fs.promises.readFile(fullPath, 'utf-8');
            res.json({ content });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

export function createRagRoutes(): Router {
    const router = Router();

    router.get('/stats', async (req, res) => {
        try {
            const { getRAGCount } = await import('../../utils/rag.js');
            const count = await getRAGCount();
            res.json({
                table: 'memory',
                provider: 'LanceDB',
                status: 'online',
                rowCount: count
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/query', async (req, res) => {
        try {
            const { query, limit } = req.query;
            if (!query) {
                res.status(400).json({ error: 'Query is required' });
                return;
            }
            const { searchRAG } = await import('../../utils/rag.js');
            const results = await searchRAG(query as string, limit ? parseInt(limit as string) : 5);
            res.json({ results });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/ingest', async (req, res) => {
        try {
            const { text, metadata } = req.body;
            if (!text) {
                res.status(400).json({ error: 'Text is required' });
                return;
            }
            const { addToIndex } = await import('../../utils/rag.js');
            await addToIndex(metadata?.path || `manual_${Date.now()}`, text);
            res.json({ status: 'success', indexed: true });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
