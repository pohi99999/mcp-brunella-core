import express from 'express';
import { logInfo, logError } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import fetch from 'node-fetch';

const router = express.Router();
const PYTHON_DEMO_FACTORY_URL = process.env.PYTHON_DEMO_FACTORY_URL || 'http://127.0.0.1:8001';

/**
 * Generates a tailored demo for a company.
 */
router.post('/generate-demo', async (req, res) => {
    const { domain, industry, company_name } = req.body;

    if (!domain || !industry) {
        return res.status(400).json({ error: 'Domain and industry are required.' });
    }

    logInfo("SalesRoutes", `Requesting demo for ${domain} (${industry})`);

    try {
        const response = await fetch(`${PYTHON_DEMO_FACTORY_URL}/generate-demo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, industry, company_name })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Python server error: ${error}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error: unknown) {
        const normalized = ensureError(error);
        logError("SalesRoutes", "Demo generation failed", normalized);
        res.status(500).json({ error: 'Failed to generate demo.' });
    }
});

export default router;
