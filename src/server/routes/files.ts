import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { vectorizeClient } from '../../utils/vectorize.js';

// Analytics tracking for Vectorize searches
interface SearchAnalytics {
  totalSearches: number;
  averageResults: number;
  topQueries: Array<{ query: string; count: number }>;
  lastSearches: Array<{ query: string; results: number; timestamp: string }>;
}

const searchStats: SearchAnalytics = {
  totalSearches: 0,
  averageResults: 0,
  topQueries: [],
  lastSearches: []
};

const queryCounter = new Map<string, number>();

function trackSearch(query: string, resultCount: number): void {
    searchStats.totalSearches++;
    
    // Update average
    const currentTotal = searchStats.averageResults * (searchStats.totalSearches - 1);
    searchStats.averageResults = (currentTotal + resultCount) / searchStats.totalSearches;
    
    // Track query frequency
    queryCounter.set(query, (queryCounter.get(query) || 0) + 1);
    
    // Update top queries (top 10)
    searchStats.topQueries = Array.from(queryCounter.entries())
        .map(([q, count]) => ({ query: q, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    
    // Track last searches (max 20)
    searchStats.lastSearches.unshift({
        query,
        results: resultCount,
        timestamp: new Date().toISOString()
    });
    
    if (searchStats.lastSearches.length > 20) {
        searchStats.lastSearches = searchStats.lastSearches.slice(0, 20);
    }
}

export function createFileRoutes(): Router {
    const router = Router();

    router.get('/list', async (req, res) => {
        try {
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
            const files = entries.map(entry => {
                const stats = fs.statSync(path.join(fullPath, entry.name));
                return {
                    name: entry.name,
                    isDirectory: entry.isDirectory(),
                    path: path.join(relPath, entry.name).replace(/\\/g, '/'),
                    size: entry.isFile() ? stats.size : 0,
                    modified: stats.mtime
                };
            });

            res.json({ files });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/content', async (req, res) => {
        try {
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
            const vectorizeStatus = vectorizeClient.getStatus();
            
            res.json({
                table: 'memory',
                provider: vectorizeStatus.enabled ? 'Vectorize + LanceDB' : 'LanceDB',
                status: 'online',
                rowCount: count,
                vectorize: {
                    enabled: vectorizeStatus.enabled,
                    indexName: vectorizeStatus.indexName
                }
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
            
            // Track analytics
            trackSearch(query as string, results.length);
            
            res.json({ results });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/analytics', (req, res) => {
        try {
            res.json({
                success: true,
                analytics: {
                    ...searchStats,
                    vectorizeEnabled: vectorizeClient.getStatus().enabled
                }
            });
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
