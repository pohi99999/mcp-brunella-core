import cron from 'node-cron';
import { logInfo, logError } from '../utils/logger.js';
import { evHunterHandler } from '../tools/evHunterTool.js';

export function startScheduler() {
    logInfo('Scheduler', 'Initializing scheduled tasks...');

    // EV Hunter - Every day at 08:00 AM
    cron.schedule('0 8 * * *', async () => {
        logInfo('Scheduler', 'Running scheduled EV Hunter task...');
        try {
            const result = await evHunterHandler({ mock: false, dryRun: false });
            if (result.isError) {
                logError('Scheduler', `EV Hunter scheduled run failed: ${JSON.stringify(result.content)}`);
            } else {
                logInfo('Scheduler', `EV Hunter scheduled run success: ${JSON.stringify(result.content)}`);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('Scheduler', `EV Hunter execution exception: ${msg}`);
        }
    });

    logInfo('Scheduler', 'Scheduled tasks active: EV Hunter (08:00 daily)');
}