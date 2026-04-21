import cron from 'node-cron';
import { logInfo, logError, logWarn } from '@packages/utils/logger.js';
import { evHunterHandler } from '@packages/utils/evHunterTool.js';
import { trackStateManager } from '@packages/core-logic/trackStateManager.js';
import { agentManager } from '@packages/agents/AgentManager.js';

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

    // Email Triage & Pipeline Monitor - Every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        logInfo('Scheduler', 'Running periodic Email Triage & Pipeline monitor...');
        try {
            const triageAgent = agentManager.getAgent('email_triage');
            if (!triageAgent) {
                logWarn('Scheduler', 'Skipping Email Triage check: email_triage agent is not currently loaded');
                return;
            }
            await agentManager.delegate('email_triage', 'process inbox', { mode: 'auto' });
            logInfo('Scheduler', 'Email Triage check completed');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('Scheduler', `Email Triage exception: ${msg}`);
        }
    });

    // Track State Manager - Every hour (full sync)
    cron.schedule('0 * * * *', async () => {
        logInfo('Scheduler', 'Running hourly Track State sync...');
        try {
            await trackStateManager.fullSync();
            logInfo('Scheduler', 'Track State sync completed successfully');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('Scheduler', `Track State sync exception: ${msg}`);
        }
    });

    logInfo('Scheduler', 'Scheduled tasks active: EV Hunter (08:00 daily), Track Sync (hourly)');
}
