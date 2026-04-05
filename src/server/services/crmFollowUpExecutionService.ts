import {
  dispatchCrmFollowUpAction,
  listCrmFollowUpActions,
} from '../../data/crm_db.js';
import { logInfo, logWarn } from '../../utils/logger.js';

export interface CrmFollowUpExecutionRunResult {
  generatedAt: string;
  scanned: number;
  dispatched: Array<NonNullable<Awaited<ReturnType<typeof dispatchCrmFollowUpAction>>>>;
}

/**
 * Scans due CRM follow-up actions, claims them atomically, and dispatches through Slack or email.
 */
export async function executeDueCrmFollowUpActions(
  options: { dbFilePath?: string; limit?: number; note?: string } = {},
): Promise<CrmFollowUpExecutionRunResult> {
  const generatedAt = new Date().toISOString();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const dueActions = listCrmFollowUpActions(limit, { status: 'scheduled' }, options.dbFilePath)
    .filter((action) => action.dueAt <= generatedAt);

  const dispatched: CrmFollowUpExecutionRunResult['dispatched'] = [];
  for (const action of dueActions) {
    const result = await dispatchCrmFollowUpAction(
      { actionId: action.id, note: options.note ?? 'scheduled dispatch' },
      { dbFilePath: options.dbFilePath },
    );

    if (!result) {
      logWarn('CrmFollowUpExecutionService', `Failed to dispatch CRM action ${action.id}`);
      continue;
    }

    dispatched.push(result);
  }

  logInfo('CrmFollowUpExecutionService', `Processed ${dispatched.length} CRM follow-up actions`);
  return {
    generatedAt,
    scanned: dueActions.length,
    dispatched,
  };
}
