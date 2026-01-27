import { toolRegistry } from './registry.js';
import { google } from 'googleapis';

const customsearch = google.customsearch('v1');

toolRegistry.registerTool({
    name: 'google_search',
    description: 'Performs a Google Search (Requires GOOGLE_API_KEY and GOOGLE_CX env vars)',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
    },
    execute: async ({ query }) => {
        if (!query) throw new Error('Query is required');

        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;

        if (!apiKey || !cx) {
            throw new Error('Missing GOOGLE_API_KEY or GOOGLE_CX environment variables. Please set them in your environment or .env file.');
        }

        try {
            const res = await customsearch.cse.list({
                cx: cx,
                q: query,
                auth: apiKey,
            });

            if (!res.data.items) return [];

            return res.data.items.map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet
            }));
        } catch (e: any) {
            throw new Error(`Search failed: ${e.message}`);
        }
    }
});
