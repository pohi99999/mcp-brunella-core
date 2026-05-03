import { z } from 'zod';

export const OPENCLAW_TRUST_ZONES = ['green', 'amber', 'red'] as const;
export type OpenClawTrustZone = typeof OPENCLAW_TRUST_ZONES[number];
export const OpenClawTrustZoneSchema = z.enum(OPENCLAW_TRUST_ZONES);

export const OPENCLAW_EXECUTION_MODES = ['read', 'constrained_write', 'exec', 'external_action'] as const;
export type OpenClawExecutionMode = typeof OPENCLAW_EXECUTION_MODES[number];
export const OpenClawExecutionModeSchema = z.enum(OPENCLAW_EXECUTION_MODES);

export const OPENCLAW_DECISION_VERDICTS = ['pass', 'fail', 'needs_review'] as const;
export type OpenClawDecisionVerdict = typeof OPENCLAW_DECISION_VERDICTS[number];
export const OpenClawDecisionVerdictSchema = z.enum(OPENCLAW_DECISION_VERDICTS);

export const OPENCLAW_RUNTIME_STATES = ['unconfigured', 'offline', 'ready', 'degraded'] as const;
export type OpenClawRuntimeState = typeof OPENCLAW_RUNTIME_STATES[number];
export const OpenClawRuntimeStateSchema = z.enum(OPENCLAW_RUNTIME_STATES);

export const OPENCLAW_DISPATCH_STATUSES = ['success', 'blocked', 'dry_run', 'failed'] as const;
export type OpenClawDispatchStatus = typeof OPENCLAW_DISPATCH_STATUSES[number];
export const OpenClawDispatchStatusSchema = z.enum(OPENCLAW_DISPATCH_STATUSES);

export const OPENCLAW_APPROVAL_STATES = ['not_required', 'pending', 'approved', 'denied', 'skipped'] as const;
export type OpenClawApprovalState = typeof OPENCLAW_APPROVAL_STATES[number];
export const OpenClawApprovalStateSchema = z.enum(OPENCLAW_APPROVAL_STATES);

const OpenClawMetadataSchema = z.record(z.string(), z.unknown());
const StringArraySchema = z.array(z.string().min(1));

export const OpenClawSourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  label: z.string().optional(),
  note: z.string().optional(),
}).strict();
export type OpenClawSource = z.infer<typeof OpenClawSourceSchema>;

export const OpenClawArtifactSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  kind: z.string().optional(),
  checksum: z.string().optional(),
  note: z.string().optional(),
}).strict();
export type OpenClawArtifact = z.infer<typeof OpenClawArtifactSchema>;

export const OpenClawLogEntrySchema = z.object({
  id: z.string().min(1),
  level: z.enum(['error', 'warn', 'info', 'debug']),
  message: z.string().min(1),
  timestamp: z.string().min(1),
  source: z.string().optional(),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawLogEntry = z.infer<typeof OpenClawLogEntrySchema>;

export const OpenClawDiffSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  changeType: z.string().min(1),
  summary: z.string().optional(),
  patch: z.string().optional(),
}).strict();
export type OpenClawDiff = z.infer<typeof OpenClawDiffSchema>;

export const OpenClawTestResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  passed: z.boolean(),
  summary: z.string().optional(),
  details: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
}).strict();
export type OpenClawTestResult = z.infer<typeof OpenClawTestResultSchema>;

export const OpenClawGoalPacketSchema = z.object({
  id: z.string().min(1),
  goal: z.string().min(1),
  priority: z.number().int().nonnegative().optional(),
  riskLevel: OpenClawTrustZoneSchema.optional(),
  successCriteria: StringArraySchema,
  requester: z.string().min(1),
  createdAt: z.string().min(1),
  correlationId: z.string().min(1),
  trackId: z.string().optional(),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawGoalPacket = z.infer<typeof OpenClawGoalPacketSchema>;

export const OpenClawExecPacketSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  targetAgent: z.string().min(1),
  executionMode: OpenClawExecutionModeSchema,
  toolScope: StringArraySchema,
  allowedConnectors: StringArraySchema,
  requiresApproval: z.boolean(),
  timeoutMs: z.number().int().positive(),
  budget: z.number().nonnegative().optional(),
  workingDirectory: z.string().optional(),
  input: z.unknown(),
  metadata: OpenClawMetadataSchema.optional(),
  trackId: z.string().optional(),
  correlationId: z.string().min(1),
}).strict();
export type OpenClawExecPacket = z.infer<typeof OpenClawExecPacketSchema>;

export const OpenClawTaskRequestSchema = z.object({
  goal: OpenClawGoalPacketSchema,
  execution: OpenClawExecPacketSchema,
  dryRun: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type OpenClawTaskRequest = z.infer<typeof OpenClawTaskRequestSchema>;

export const OpenClawApprovalRequestSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  executionId: z.string().min(1),
  agentName: z.string().min(1),
  trustZone: OpenClawTrustZoneSchema,
  reasonCodes: StringArraySchema,
  summary: z.string().min(1),
  correlationId: z.string().min(1),
  trackId: z.string().optional(),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawApprovalRequest = z.infer<typeof OpenClawApprovalRequestSchema>;

export const OpenClawApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  reviewer: z.string().optional(),
  reason: z.string().optional(),
  decidedAt: z.string().min(1),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawApprovalDecision = z.infer<typeof OpenClawApprovalDecisionSchema>;

export const OpenClawPolicyDecisionSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  targetAgent: z.string().min(1),
  trustZone: OpenClawTrustZoneSchema,
  executionMode: OpenClawExecutionModeSchema,
  verdict: OpenClawDecisionVerdictSchema,
  canDispatch: z.boolean(),
  requiresApproval: z.boolean(),
  approvalEligible: z.boolean(),
  reasonCodes: StringArraySchema,
  blockedReasons: StringArraySchema,
  isDestructive: z.boolean(),
  redactionApplied: z.boolean(),
  createdAt: z.string().min(1),
  correlationId: z.string().min(1),
  trackId: z.string().optional(),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawPolicyDecision = z.infer<typeof OpenClawPolicyDecisionSchema>;

export const OpenClawEvidencePacketSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  executionId: z.string().min(1),
  sources: z.array(OpenClawSourceSchema),
  artifacts: z.array(OpenClawArtifactSchema),
  logs: z.array(OpenClawLogEntrySchema),
  diffs: z.array(OpenClawDiffSchema),
  testResults: z.array(OpenClawTestResultSchema),
  confidence: z.number().min(0).max(1).optional(),
  capturedAt: z.string().min(1),
  redactionApplied: z.boolean(),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawEvidencePacket = z.infer<typeof OpenClawEvidencePacketSchema>;

export const OpenClawGatewayRequestSchema = z.object({
  id: z.string().min(1),
  correlationId: z.string().min(1),
  dryRun: z.boolean().optional(),
  packet: OpenClawExecPacketSchema,
  policy: OpenClawPolicyDecisionSchema,
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawGatewayRequest = z.infer<typeof OpenClawGatewayRequestSchema>;

export const OpenClawGatewayResponseSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'blocked', 'dry_run', 'cancelled', 'failed']),
  output: z.unknown().optional(),
  evidence: OpenClawEvidencePacketSchema.optional(),
  warnings: z.array(z.string()).default([]),
  receivedAt: z.string().min(1),
  correlationId: z.string().optional(),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawGatewayResponse = z.infer<typeof OpenClawGatewayResponseSchema>;

export const OpenClawDispatchResultSchema = z.object({
  requestId: z.string().min(1),
  goalId: z.string().min(1),
  runId: z.string().optional(),
  status: OpenClawDispatchStatusSchema,
  approvalState: OpenClawApprovalStateSchema,
  policy: OpenClawPolicyDecisionSchema,
  gatewayResponse: OpenClawGatewayResponseSchema.optional(),
  evidence: OpenClawEvidencePacketSchema.optional(),
  durationMs: z.number().nonnegative(),
  message: z.string().optional(),
  error: z.string().optional(),
  redactionApplied: z.boolean(),
  correlationId: z.string().min(1),
  trackId: z.string().optional(),
  approvedBy: z.string().optional(),
  metadata: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawDispatchResult = z.infer<typeof OpenClawDispatchResultSchema>;

export const OpenClawStatusSnapshotSchema = z.object({
  state: OpenClawRuntimeStateSchema,
  configured: z.boolean(),
  reachable: z.boolean(),
  baseUrl: z.string().nullable().optional(),
  defaultTrustZone: OpenClawTrustZoneSchema,
  approvalThreshold: OpenClawTrustZoneSchema,
  enabledExecutors: z.array(z.string()),
  redactionEnabled: z.boolean(),
  lastCheckedAt: z.string().min(1),
  message: z.string().optional(),
  details: OpenClawMetadataSchema.optional(),
}).strict();
export type OpenClawStatusSnapshot = z.infer<typeof OpenClawStatusSnapshotSchema>;

export const OpenClawRedactionSchema = z.object({
  enabled: z.boolean(),
  mask: z.string().min(1),
  sensitiveKeys: StringArraySchema,
}).strict();
export type OpenClawRedaction = z.infer<typeof OpenClawRedactionSchema>;

export const OpenClawConfigSchema = z.object({
  baseUrl: z.string().url().nullable(),
  apiKey: z.string().optional(),
  apiKeyRef: z.string().optional(),
  tokenRef: z.string().optional(),
  timeoutMs: z.number().int().positive(),
  retryCount: z.number().int().nonnegative(),
  retryDelayMs: z.number().int().nonnegative(),
  defaultTrustZone: OpenClawTrustZoneSchema,
  approvalThreshold: OpenClawTrustZoneSchema,
  enabled: z.boolean(),
  allowedAgents: z.array(z.string()),
  allowedToolPresets: z.array(z.string()),
  agentAllowlists: z.record(z.string(), z.array(z.string())),
  redaction: OpenClawRedactionSchema,
}).strict();
export type OpenClawConfig = z.infer<typeof OpenClawConfigSchema>;

export const OpenClawRuntimeSnapshotSchema = z.object({
  config: OpenClawConfigSchema,
  status: OpenClawStatusSnapshotSchema,
}).strict();
export type OpenClawRuntimeSnapshot = z.infer<typeof OpenClawRuntimeSnapshotSchema>;
