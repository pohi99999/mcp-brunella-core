import {
  createCrmFollowUpPlan,
  getCrmFollowUpStats,
  getCrmFollowUpSummary,
  getCrmLeadStats,
  ingestCrmLead,
  type CrmFollowUpActionRecord,
  type CrmFollowUpPlanRecord,
  type CrmLeadRecord,
} from '../../data/crm_db.js';
import { normalizeCrmLead } from '../../utils/crmLead.js';
import { logInfo, logWarn } from '../../utils/logger.js';
import { fireHookSafely } from '../../core/hookRegistry.js';

export type KkvCrmLeadStats = ReturnType<typeof getCrmLeadStats>;
export type KkvCrmFollowUpStats = ReturnType<typeof getCrmFollowUpStats>;
export type KkvCrmFollowUpSummary = ReturnType<typeof getCrmFollowUpSummary>;

export interface KkvCrmSnapshot {
  generatedAt: string;
  leadStats: KkvCrmLeadStats;
  followUpStats: KkvCrmFollowUpStats;
  followUpSummary: KkvCrmFollowUpSummary;
}

export interface KkvCrmCreateLeadOptions {
  dbFilePath?: string;
  workflowId?: string;
  createFollowUpPlan?: boolean;
}

export interface KkvCrmCreateLeadSuccess {
  success: true;
  inserted: boolean;
  eventType: 'created' | 'deduped';
  createdAt: string;
  lead: CrmLeadRecord;
  followUpCreated: boolean;
  followUpPlan: CrmFollowUpPlanRecord | null;
  followUpActions: CrmFollowUpActionRecord[];
  snapshot: KkvCrmSnapshot;
}

export interface KkvCrmCreateLeadFailure {
  success: false;
  error: string;
  statusCode: 400;
}

export interface KkvCrmStatusSnapshot extends KkvCrmSnapshot {
  success: true;
}

function buildSnapshot(dbFilePath?: string): KkvCrmSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    leadStats: getCrmLeadStats(dbFilePath),
    followUpStats: getCrmFollowUpStats(dbFilePath),
    followUpSummary: getCrmFollowUpSummary(dbFilePath),
  };
}

export const kkvCrmService = {
  async createLead(
    payload: unknown,
    options: KkvCrmCreateLeadOptions = {},
  ): Promise<KkvCrmCreateLeadSuccess | KkvCrmCreateLeadFailure> {
    const normalizedLead = normalizeCrmLead(payload);
    if (!normalizedLead) {
      logWarn('KkvCrmService', 'Rejected invalid CRM lead payload');
      return {
        success: false,
        error: 'Invalid CRM lead payload',
        statusCode: 400,
      };
    }

    const ingested = ingestCrmLead(normalizedLead, {
      dbFilePath: options.dbFilePath,
      workflowId: options.workflowId,
    });

    const followUpPlan = options.createFollowUpPlan === false
      ? null
      : createCrmFollowUpPlan(ingested.lead.id, { dbFilePath: options.dbFilePath });

    const snapshot = buildSnapshot(options.dbFilePath);
    const followUpActions = followUpPlan?.actions ?? [];

    logInfo(
      'KkvCrmService',
      `${ingested.eventType} lead ${ingested.lead.id} from ${ingested.lead.source}` +
        (followUpPlan ? ' with follow-up plan' : ' without follow-up plan'),
    );

    await fireHookSafely('crm:lead:created', {
      eventType: ingested.eventType,
      workflowId: options.workflowId,
      lead: ingested.lead,
      followUpCreated: Boolean(followUpPlan),
      followUpPlan: followUpPlan?.plan ?? null,
      followUpActions,
    }, {
      source: 'kkv-crm-service',
      metadata: { eventType: ingested.eventType, leadId: ingested.lead.id },
      logContext: 'KkvCrmService',
    });

    return {
      success: true,
      inserted: ingested.inserted,
      eventType: ingested.eventType,
      createdAt: ingested.lead.createdAt,
      lead: ingested.lead,
      followUpCreated: Boolean(followUpPlan),
      followUpPlan: followUpPlan?.plan ?? null,
      followUpActions,
      snapshot,
    };
  },

  getStatus(options: { dbFilePath?: string } = {}): KkvCrmStatusSnapshot {
    return {
      success: true,
      ...buildSnapshot(options.dbFilePath),
    };
  },
};
