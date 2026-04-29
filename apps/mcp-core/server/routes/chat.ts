import { Router } from 'express';
import { getMessages } from '@packages/utils/db.js';

export function createChatRoutes(): Router {
    const router = Router();

    router.get('/messages', (req, res) => {
        try {
            const chatId = req.query.chatId as string || 'main-session';
            const messages = getMessages(chatId);
            res.json({ messages });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, messages: [] });
        }
    });

    return router;
}

export function createAnythingLLMRoutes(): Router {
    const router = Router();

    router.get('/workspaces', async (req, res) => {
        try {
            const baseUrl = process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001';
            const apiKey = process.env.ANYTHINGLLM_API_KEY;

            if (!apiKey) {
                res.status(500).json({ error: 'AnythingLLM API key not configured', workspaces: [] });
                return;
            }

            const response = await fetch(`${baseUrl}/api/v1/workspaces`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`AnythingLLM API error: ${response.statusText}`);
            }

            const data = await response.json() as { workspaces?: unknown[] };
            res.json({ workspaces: data.workspaces || [] });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, workspaces: [] });
        }
    });

    router.post('/chat', async (req, res) => {
        try {
            const { workspace, message, mode } = req.body;

            if (!workspace || !message) {
                res.status(400).json({ error: 'Workspace and message are required' });
                return;
            }

            const baseUrl = process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001';
            const apiKey = process.env.ANYTHINGLLM_API_KEY;

            if (!apiKey) {
                res.status(500).json({ error: 'AnythingLLM API key not configured' });
                return;
            }

            const response = await fetch(`${baseUrl}/api/v1/workspace/${workspace}/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message, mode: mode || 'chat' }),
                signal: AbortSignal.timeout(60000)
            });

            if (!response.ok) {
                throw new Error(`AnythingLLM API error: ${response.statusText}`);
            }

            const data = await response.json() as { textResponse?: string; response?: string };
            res.json({ response: data.textResponse || data.response });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
