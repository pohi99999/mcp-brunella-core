import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { logInfo, logError } from '../../utils/logger.js';

const router = express.Router();
const GRANTS_PATH = path.join(process.cwd(), 'config', 'grants_2026.json');

/**
 * Grant Advisor API - Returns grant info and eligibility tips.
 */
router.post('/advisor', async (req, res) => {
    const { industry, years_active, employee_count } = req.body;

    try {
        const data = await fs.readFile(GRANTS_PATH, 'utf-8');
        const { grants, sales_angles } = JSON.parse(data);

        // Simple eligibility logic
        let recommendedGrant = grants[0];
        if (employee_count < 10) recommendedGrant = grants[1]; // DIMOP for micros

        const response = {
            recommended_grant: recommendedGrant,
            angle: sales_angles[industry] || "Személyre szabott digitális fejlesztés.",
            next_step: "Kérje ingyenes auditunkat a támogatás maximalizálásához!"
        };

        res.json(response);
    } catch (err: any) {
        logError("GrantsRouter", `Advisor error: ${err.message}`);
        res.status(500).json({ error: 'Failed to process grant inquiry.' });
    }
});

export default router;
