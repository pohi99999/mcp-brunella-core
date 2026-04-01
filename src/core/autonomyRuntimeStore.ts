import { getGlobalDb } from '../utils/globalDb.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';
import type { ApprovalRequest } from '../utils/approvalManager.js';
import type { ApprovalWorkflow } from './approvalRouter.js';
import type { EphemeralAgentRecord } from './ephemeralAgentManager.js';
import type { NotificationDeliveryRecord } from './notificationChannels.js';
import type { RemediationRunRecord } from './remediationRuntime.types.js';
import type { CapabilityManifest } from './federation/capabilityManifest.js';
import type { NegotiationSession } from './federation/negotiationProtocol.js';
import type { PeerIdentity } from './federation/trustRegistry.js';

interface ApprovalRequestRow {
  id: string;
  type: ApprovalRequest['type'];
  description: string;
  metadata_json: string | null;
  status: ApprovalRequest['status'];
  created_at: number;
  expires_at: number;
  response_json: string | null;
  responded_at: number | null;
  updated_at: number;
}

interface ApprovalWorkflowRow {
  workflow_id: string;
  approval_request_id: string;
  event_id: string;
  status: ApprovalWorkflow['status'];
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  timeout_ms: number;
  event_type: string;
  source: string;
  agent_name: string | null;
  resource: string | null;
  decision_json: string;
  response_json: string | null;
  event_payload_json: string;
  event_metadata_json: string | null;
  callback_json: string;
}

interface EphemeralAgentRow {
  agent_id: string;
  state: EphemeralAgentRecord['state'];
  spec_json: string;
  spawned_at: string;
  terminated_at: string | null;
  termination_reason: string | null;
  token_used: number;
  cost_used: number;
  steps_used: number;
  lease_json: string;
  approval_json: string | null;
  audit_trail_json: string;
  updated_at: string;
}

interface FederationPeerRow {
  peer_id: string;
  display_name: string;
  endpoint: string;
  public_key: string | null;
  trust_state: PeerIdentity['trustState'];
  trusted_at: string | null;
  revoked_at: string | null;
  metadata_json: string | null;
  updated_at: string;
}

interface CapabilityManifestRow {
  manifest_id: string;
  peer_id: string;
  version: string;
  issued_at: string;
  expires_at: string;
  signature: string;
  capabilities_json: string;
  updated_at: string;
}

interface NegotiationSessionRow {
  session_id: string;
  state: NegotiationSession['state'];
  initial_offer_json: string;
  counter_offer_json: string | null;
  agreed_capabilities_json: string | null;
  agreed_terms_json: string | null;
  rejection_reason: string | null;
  created_at: string;
  resolved_at: string | null;
  requires_approval: number;
  approval_workflow_id: string | null;
  approval_request_id: string | null;
  transcript_json: string;
  updated_at: string;
}

interface NotificationDeliveryRow {
  id: string;
  workflow_id: string | null;
  approval_request_id: string | null;
  channel: NotificationDeliveryRecord['channel'];
  status: NotificationDeliveryRecord['status'];
  event_type: NotificationDeliveryRecord['eventType'];
  title: string;
  message: string;
  error: string | null;
  created_at: string;
  metadata_json: string | null;
}

interface RemediationRunRow {
  run_id: string;
  source_event_id: string;
  source_dedup_key: string;
  source_event_type: string;
  repository_name: string;
  repository_owner: string | null;
  repository_repo: string | null;
  workflow_run_id: string | null;
  workflow_name: string | null;
  branch: string | null;
  html_url: string | null;
  status: RemediationRunRecord['status'];
  created_at: string;
  updated_at: string;
  logs_excerpt: string | null;
  analysis_json: string | null;
  fixer_json: string | null;
  verification_json: string;
  final_approval_json: string | null;
  failure_reason: string | null;
}

let initialized = false;

function serializeJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson<T>(raw: string | null, label: string): T | undefined {
  if (raw === null) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logWarn(
      'AutonomyRuntimeStore',
      `Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

function ensureTables(): void {
  if (initialized) {
    return;
  }

  const db = getGlobalDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_requests_runtime (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      response_json TEXT,
      responded_at INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_approval_requests_runtime_status
      ON approval_requests_runtime(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS approval_workflows_runtime (
      workflow_id TEXT PRIMARY KEY,
      approval_request_id TEXT NOT NULL UNIQUE,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      responded_at TEXT,
      timeout_ms INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      agent_name TEXT,
      resource TEXT,
      decision_json TEXT NOT NULL,
      response_json TEXT,
      event_payload_json TEXT NOT NULL,
      event_metadata_json TEXT,
      callback_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_approval_workflows_runtime_status
      ON approval_workflows_runtime(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS ephemeral_agents_runtime (
      agent_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      spec_json TEXT NOT NULL,
      spawned_at TEXT NOT NULL,
      terminated_at TEXT,
      termination_reason TEXT,
      token_used INTEGER NOT NULL DEFAULT 0,
      cost_used REAL NOT NULL DEFAULT 0,
      steps_used INTEGER NOT NULL DEFAULT 0,
      lease_json TEXT NOT NULL,
      approval_json TEXT,
      audit_trail_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ephemeral_agents_runtime_state
      ON ephemeral_agents_runtime(state, updated_at DESC);

    CREATE TABLE IF NOT EXISTS federation_peers_runtime (
      peer_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      public_key TEXT,
      trust_state TEXT NOT NULL,
      trusted_at TEXT,
      revoked_at TEXT,
      metadata_json TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_federation_peers_runtime_state
      ON federation_peers_runtime(trust_state, updated_at DESC);

    CREATE TABLE IF NOT EXISTS federation_manifests_runtime (
      manifest_id TEXT PRIMARY KEY,
      peer_id TEXT NOT NULL,
      version TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      signature TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_federation_manifests_runtime_peer
      ON federation_manifests_runtime(peer_id, issued_at DESC);

    CREATE TABLE IF NOT EXISTS federation_negotiations_runtime (
      session_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      initial_offer_json TEXT NOT NULL,
      counter_offer_json TEXT,
      agreed_capabilities_json TEXT,
      agreed_terms_json TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      approval_workflow_id TEXT,
      approval_request_id TEXT,
      transcript_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_federation_negotiations_runtime_state
      ON federation_negotiations_runtime(state, updated_at DESC);

    CREATE TABLE IF NOT EXISTS notification_deliveries_runtime (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      approval_request_id TEXT,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notification_deliveries_runtime_created
      ON notification_deliveries_runtime(created_at DESC);

    CREATE TABLE IF NOT EXISTS remediation_runs_runtime (
      run_id TEXT PRIMARY KEY,
      source_event_id TEXT NOT NULL,
      source_dedup_key TEXT NOT NULL UNIQUE,
      source_event_type TEXT NOT NULL,
      repository_name TEXT NOT NULL,
      repository_owner TEXT,
      repository_repo TEXT,
      workflow_run_id TEXT,
      workflow_name TEXT,
      branch TEXT,
      html_url TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      logs_excerpt TEXT,
      analysis_json TEXT,
      fixer_json TEXT,
      verification_json TEXT NOT NULL,
      final_approval_json TEXT,
      failure_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_remediation_runs_runtime_status
      ON remediation_runs_runtime(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_remediation_runs_runtime_repo
      ON remediation_runs_runtime(repository_name, created_at DESC);
  `);

  initialized = true;
  logInfo('AutonomyRuntimeStore', 'Runtime persistence tables ready');
}

export function saveApprovalRequest(request: ApprovalRequest): void {
  try {
    ensureTables();
    const db = getGlobalDb();
    db.prepare(`
      INSERT INTO approval_requests_runtime (
        id, type, description, metadata_json, status, created_at, expires_at, response_json, responded_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        description = excluded.description,
        metadata_json = excluded.metadata_json,
        status = excluded.status,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        response_json = excluded.response_json,
        responded_at = excluded.responded_at,
        updated_at = excluded.updated_at
    `).run(
      request.id,
      request.type,
      request.description,
      serializeJson(request.metadata),
      request.status,
      request.createdAt,
      request.expiresAt,
      serializeJson(request.response),
      request.respondedAt ?? null,
      Date.now(),
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save approval request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function deleteApprovalRequest(id: string): void {
  try {
    ensureTables();
    getGlobalDb().prepare('DELETE FROM approval_requests_runtime WHERE id = ?').run(id);
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to delete approval request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadApprovalRequests(): ApprovalRequest[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT id, type, description, metadata_json, status, created_at, expires_at, response_json, responded_at, updated_at
        FROM approval_requests_runtime
        ORDER BY created_at DESC
      `)
      .all() as ApprovalRequestRow[];

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      description: row.description,
      metadata: parseJson(row.metadata_json, `approval_request:${row.id}:metadata`),
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      response: parseJson(row.response_json, `approval_request:${row.id}:response`),
      respondedAt: row.responded_at ?? undefined,
    }));
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load approval requests: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearApprovalRequests(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM approval_requests_runtime').run();
}

export function saveApprovalWorkflow(workflow: ApprovalWorkflow): void {
  try {
    ensureTables();
    const db = getGlobalDb();
    db.prepare(`
      INSERT INTO approval_workflows_runtime (
        workflow_id, approval_request_id, event_id, status, created_at, updated_at, responded_at,
        timeout_ms, event_type, source, agent_name, resource, decision_json, response_json,
        event_payload_json, event_metadata_json, callback_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workflow_id) DO UPDATE SET
        approval_request_id = excluded.approval_request_id,
        event_id = excluded.event_id,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        responded_at = excluded.responded_at,
        timeout_ms = excluded.timeout_ms,
        event_type = excluded.event_type,
        source = excluded.source,
        agent_name = excluded.agent_name,
        resource = excluded.resource,
        decision_json = excluded.decision_json,
        response_json = excluded.response_json,
        event_payload_json = excluded.event_payload_json,
        event_metadata_json = excluded.event_metadata_json,
        callback_json = excluded.callback_json
    `).run(
      workflow.workflowId,
      workflow.approvalRequestId,
      workflow.eventId,
      workflow.status,
      workflow.createdAt,
      workflow.updatedAt,
      workflow.respondedAt ?? null,
      workflow.timeoutMs,
      workflow.eventType,
      workflow.source,
      workflow.agentName ?? null,
      workflow.resource ?? null,
      JSON.stringify(workflow.decision),
      serializeJson(workflow.response),
      JSON.stringify(workflow.eventPayload),
      serializeJson(workflow.eventMetadata),
      JSON.stringify(workflow.callback),
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save approval workflow: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadApprovalWorkflows(): ApprovalWorkflow[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT workflow_id, approval_request_id, event_id, status, created_at, updated_at, responded_at,
               timeout_ms, event_type, source, agent_name, resource, decision_json, response_json,
               event_payload_json, event_metadata_json, callback_json
        FROM approval_workflows_runtime
        ORDER BY created_at DESC
      `)
      .all() as ApprovalWorkflowRow[];

    return rows.flatMap((row) => {
      const decision = parseJson<ApprovalWorkflow['decision']>(row.decision_json, `approval_workflow:${row.workflow_id}:decision`);
      const eventPayload = parseJson<ApprovalWorkflow['eventPayload']>(row.event_payload_json, `approval_workflow:${row.workflow_id}:payload`);
      const callback = parseJson<ApprovalWorkflow['callback']>(row.callback_json, `approval_workflow:${row.workflow_id}:callback`);

      if (!decision || eventPayload === undefined || !callback) {
        return [];
      }

      return [{
        workflowId: row.workflow_id,
        approvalRequestId: row.approval_request_id,
        eventId: row.event_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        respondedAt: row.responded_at ?? undefined,
        timeoutMs: row.timeout_ms,
        eventType: row.event_type,
        source: row.source,
        agentName: row.agent_name ?? undefined,
        resource: row.resource ?? undefined,
        decision,
        response: parseJson(row.response_json, `approval_workflow:${row.workflow_id}:response`),
        eventPayload,
        eventMetadata: parseJson(row.event_metadata_json, `approval_workflow:${row.workflow_id}:metadata`),
        callback,
      }];
    });
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load approval workflows: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearApprovalWorkflows(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM approval_workflows_runtime').run();
}

export function saveRemediationRun(record: RemediationRunRecord): void {
  try {
    ensureTables();
    getGlobalDb().prepare(`
      INSERT INTO remediation_runs_runtime (
        run_id, source_event_id, source_dedup_key, source_event_type, repository_name, repository_owner, repository_repo,
        workflow_run_id, workflow_name, branch, html_url, status, created_at, updated_at, logs_excerpt,
        analysis_json, fixer_json, verification_json, final_approval_json, failure_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        source_event_id = excluded.source_event_id,
        source_dedup_key = excluded.source_dedup_key,
        source_event_type = excluded.source_event_type,
        repository_name = excluded.repository_name,
        repository_owner = excluded.repository_owner,
        repository_repo = excluded.repository_repo,
        workflow_run_id = excluded.workflow_run_id,
        workflow_name = excluded.workflow_name,
        branch = excluded.branch,
        html_url = excluded.html_url,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        logs_excerpt = excluded.logs_excerpt,
        analysis_json = excluded.analysis_json,
        fixer_json = excluded.fixer_json,
        verification_json = excluded.verification_json,
        final_approval_json = excluded.final_approval_json,
        failure_reason = excluded.failure_reason
    `).run(
      record.id,
      record.sourceEventId,
      record.sourceDedupKey,
      record.sourceEventType,
      record.repositoryName,
      record.repositoryOwner ?? null,
      record.repositoryRepo ?? null,
      record.workflowRunId ?? null,
      record.workflowName ?? null,
      record.branch ?? null,
      record.htmlUrl ?? null,
      record.status,
      record.createdAt,
      record.updatedAt,
      record.logsExcerpt ?? null,
      serializeJson(record.analysis),
      serializeJson(record.fixer),
      JSON.stringify(record.verification),
      serializeJson(record.finalApproval),
      record.failureReason ?? null,
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save remediation run: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadRemediationRuns(): RemediationRunRecord[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT run_id, source_event_id, source_dedup_key, source_event_type, repository_name, repository_owner, repository_repo,
               workflow_run_id, workflow_name, branch, html_url, status, created_at, updated_at, logs_excerpt,
               analysis_json, fixer_json, verification_json, final_approval_json, failure_reason
        FROM remediation_runs_runtime
        ORDER BY created_at DESC
      `)
      .all() as RemediationRunRow[];

    return rows.flatMap((row) => {
      const verification = parseJson<RemediationRunRecord['verification']>(
        row.verification_json,
        `remediation_run:${row.run_id}:verification`,
      );

      if (!verification) {
        return [];
      }

      return [{
        id: row.run_id,
        sourceEventId: row.source_event_id,
        sourceDedupKey: row.source_dedup_key,
        sourceEventType: row.source_event_type,
        repositoryName: row.repository_name,
        repositoryOwner: row.repository_owner ?? undefined,
        repositoryRepo: row.repository_repo ?? undefined,
        workflowRunId: row.workflow_run_id ?? undefined,
        workflowName: row.workflow_name ?? undefined,
        branch: row.branch ?? undefined,
        htmlUrl: row.html_url ?? undefined,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        logsExcerpt: row.logs_excerpt ?? undefined,
        analysis: parseJson(row.analysis_json, `remediation_run:${row.run_id}:analysis`),
        fixer: parseJson(row.fixer_json, `remediation_run:${row.run_id}:fixer`),
        verification,
        finalApproval: parseJson(row.final_approval_json, `remediation_run:${row.run_id}:finalApproval`),
        failureReason: row.failure_reason ?? undefined,
      }];
    });
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load remediation runs: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearRemediationRuns(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM remediation_runs_runtime').run();
}

export function saveEphemeralAgentRecord(record: EphemeralAgentRecord): void {
  try {
    ensureTables();
    getGlobalDb().prepare(`
      INSERT INTO ephemeral_agents_runtime (
        agent_id, state, spec_json, spawned_at, terminated_at, termination_reason, token_used, cost_used,
        steps_used, lease_json, approval_json, audit_trail_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        state = excluded.state,
        spec_json = excluded.spec_json,
        spawned_at = excluded.spawned_at,
        terminated_at = excluded.terminated_at,
        termination_reason = excluded.termination_reason,
        token_used = excluded.token_used,
        cost_used = excluded.cost_used,
        steps_used = excluded.steps_used,
        lease_json = excluded.lease_json,
        approval_json = excluded.approval_json,
        audit_trail_json = excluded.audit_trail_json,
        updated_at = excluded.updated_at
    `).run(
      record.id,
      record.state,
      JSON.stringify(record.spec),
      record.spawnedAt,
      record.terminatedAt ?? null,
      record.terminationReason ?? null,
      record.tokenUsed,
      record.costUsed,
      record.stepsUsed,
      JSON.stringify(record.lease),
      serializeJson(record.approval),
      JSON.stringify(record.auditTrail),
      new Date().toISOString(),
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save ephemeral agent record: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadEphemeralAgentRecords(): EphemeralAgentRecord[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT agent_id, state, spec_json, spawned_at, terminated_at, termination_reason, token_used, cost_used,
               steps_used, lease_json, approval_json, audit_trail_json, updated_at
        FROM ephemeral_agents_runtime
        ORDER BY spawned_at DESC
      `)
      .all() as EphemeralAgentRow[];

    return rows.flatMap((row) => {
      const spec = parseJson<EphemeralAgentRecord['spec']>(row.spec_json, `ephemeral_agent:${row.agent_id}:spec`);
      const lease = parseJson<EphemeralAgentRecord['lease']>(row.lease_json, `ephemeral_agent:${row.agent_id}:lease`);
      const auditTrail = parseJson<EphemeralAgentRecord['auditTrail']>(row.audit_trail_json, `ephemeral_agent:${row.agent_id}:audit`);
      if (!spec || !lease || !auditTrail) {
        return [];
      }

      return [{
        id: row.agent_id,
        spec,
        state: row.state,
        spawnedAt: row.spawned_at,
        terminatedAt: row.terminated_at ?? undefined,
        terminationReason: row.termination_reason ?? undefined,
        tokenUsed: row.token_used,
        costUsed: row.cost_used,
        stepsUsed: row.steps_used,
        lease,
        approval: parseJson(row.approval_json, `ephemeral_agent:${row.agent_id}:approval`),
        auditTrail,
      }];
    });
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load ephemeral agent records: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearEphemeralAgentRecords(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM ephemeral_agents_runtime').run();
}

export function saveFederationPeer(peer: PeerIdentity): void {
  try {
    ensureTables();
    getGlobalDb().prepare(`
      INSERT INTO federation_peers_runtime (
        peer_id, display_name, endpoint, public_key, trust_state, trusted_at, revoked_at, metadata_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(peer_id) DO UPDATE SET
        display_name = excluded.display_name,
        endpoint = excluded.endpoint,
        public_key = excluded.public_key,
        trust_state = excluded.trust_state,
        trusted_at = excluded.trusted_at,
        revoked_at = excluded.revoked_at,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run(
      peer.peerId,
      peer.displayName,
      peer.endpoint,
      peer.publicKey ?? null,
      peer.trustState,
      peer.trustedAt ?? null,
      peer.revokedAt ?? null,
      serializeJson(peer.metadata),
      new Date().toISOString(),
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save federation peer: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadFederationPeers(): PeerIdentity[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT peer_id, display_name, endpoint, public_key, trust_state, trusted_at, revoked_at, metadata_json, updated_at
        FROM federation_peers_runtime
        ORDER BY updated_at DESC
      `)
      .all() as FederationPeerRow[];

    return rows.map((row) => ({
      peerId: row.peer_id,
      displayName: row.display_name,
      endpoint: row.endpoint,
      publicKey: row.public_key ?? undefined,
      trustState: row.trust_state,
      trustedAt: row.trusted_at ?? undefined,
      revokedAt: row.revoked_at ?? undefined,
      metadata: parseJson(row.metadata_json, `federation_peer:${row.peer_id}:metadata`),
    }));
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load federation peers: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearFederationPeers(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM federation_peers_runtime').run();
}

export function saveCapabilityManifest(manifest: CapabilityManifest): void {
  try {
    ensureTables();
    getGlobalDb().prepare(`
      INSERT INTO federation_manifests_runtime (
        manifest_id, peer_id, version, issued_at, expires_at, signature, capabilities_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(manifest_id) DO UPDATE SET
        peer_id = excluded.peer_id,
        version = excluded.version,
        issued_at = excluded.issued_at,
        expires_at = excluded.expires_at,
        signature = excluded.signature,
        capabilities_json = excluded.capabilities_json,
        updated_at = excluded.updated_at
    `).run(
      manifest.manifestId,
      manifest.peerId,
      manifest.version,
      manifest.issuedAt,
      manifest.expiresAt,
      manifest.signature,
      JSON.stringify(manifest.capabilities),
      new Date().toISOString(),
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save capability manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadCapabilityManifests(): CapabilityManifest[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT manifest_id, peer_id, version, issued_at, expires_at, signature, capabilities_json, updated_at
        FROM federation_manifests_runtime
        ORDER BY issued_at DESC
      `)
      .all() as CapabilityManifestRow[];

    return rows.flatMap((row) => {
      const capabilities = parseJson<CapabilityManifest['capabilities']>(row.capabilities_json, `capability_manifest:${row.manifest_id}:capabilities`);
      if (!capabilities) {
        return [];
      }

      return [{
        manifestId: row.manifest_id,
        peerId: row.peer_id,
        capabilities,
        version: row.version,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        signature: row.signature,
      }];
    });
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load capability manifests: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearCapabilityManifests(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM federation_manifests_runtime').run();
}

export function saveNegotiationSession(session: NegotiationSession): void {
  try {
    ensureTables();
    getGlobalDb().prepare(`
      INSERT INTO federation_negotiations_runtime (
        session_id, state, initial_offer_json, counter_offer_json, agreed_capabilities_json, agreed_terms_json,
        rejection_reason, created_at, resolved_at, requires_approval, approval_workflow_id, approval_request_id,
        transcript_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        state = excluded.state,
        initial_offer_json = excluded.initial_offer_json,
        counter_offer_json = excluded.counter_offer_json,
        agreed_capabilities_json = excluded.agreed_capabilities_json,
        agreed_terms_json = excluded.agreed_terms_json,
        rejection_reason = excluded.rejection_reason,
        created_at = excluded.created_at,
        resolved_at = excluded.resolved_at,
        requires_approval = excluded.requires_approval,
        approval_workflow_id = excluded.approval_workflow_id,
        approval_request_id = excluded.approval_request_id,
        transcript_json = excluded.transcript_json,
        updated_at = excluded.updated_at
    `).run(
      session.sessionId,
      session.state,
      JSON.stringify(session.initialOffer),
      serializeJson(session.counterOffer),
      serializeJson(session.agreedCapabilities),
      serializeJson(session.agreedTerms),
      session.rejectionReason ?? null,
      session.createdAt,
      session.resolvedAt ?? null,
      session.requiresApproval ? 1 : 0,
      session.approvalWorkflowId ?? null,
      session.approvalRequestId ?? null,
      JSON.stringify(session.transcript),
      new Date().toISOString(),
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save negotiation session: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadNegotiationSessions(): NegotiationSession[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT session_id, state, initial_offer_json, counter_offer_json, agreed_capabilities_json, agreed_terms_json,
               rejection_reason, created_at, resolved_at, requires_approval, approval_workflow_id, approval_request_id,
               transcript_json, updated_at
        FROM federation_negotiations_runtime
        ORDER BY created_at DESC
      `)
      .all() as NegotiationSessionRow[];

    return rows.flatMap((row) => {
      const initialOffer = parseJson<NegotiationSession['initialOffer']>(row.initial_offer_json, `negotiation:${row.session_id}:initial_offer`);
      const transcript = parseJson<NegotiationSession['transcript']>(row.transcript_json, `negotiation:${row.session_id}:transcript`);
      if (!initialOffer || !transcript) {
        return [];
      }

      return [{
        sessionId: row.session_id,
        state: row.state,
        initialOffer,
        counterOffer: parseJson(row.counter_offer_json, `negotiation:${row.session_id}:counter_offer`),
        agreedCapabilities: parseJson(row.agreed_capabilities_json, `negotiation:${row.session_id}:agreed_capabilities`),
        agreedTerms: parseJson(row.agreed_terms_json, `negotiation:${row.session_id}:agreed_terms`),
        rejectionReason: row.rejection_reason ?? undefined,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at ?? undefined,
        requiresApproval: row.requires_approval === 1,
        approvalWorkflowId: row.approval_workflow_id ?? undefined,
        approvalRequestId: row.approval_request_id ?? undefined,
        transcript,
      }];
    });
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load negotiation sessions: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearNegotiationSessions(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM federation_negotiations_runtime').run();
}

export function saveNotificationDelivery(record: NotificationDeliveryRecord): void {
  try {
    ensureTables();
    getGlobalDb().prepare(`
      INSERT INTO notification_deliveries_runtime (
        id, workflow_id, approval_request_id, channel, status, event_type, title, message, error, created_at, metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workflow_id = excluded.workflow_id,
        approval_request_id = excluded.approval_request_id,
        channel = excluded.channel,
        status = excluded.status,
        event_type = excluded.event_type,
        title = excluded.title,
        message = excluded.message,
        error = excluded.error,
        created_at = excluded.created_at,
        metadata_json = excluded.metadata_json
    `).run(
      record.id,
      record.workflowId ?? null,
      record.approvalRequestId ?? null,
      record.channel,
      record.status,
      record.eventType,
      record.title,
      record.message,
      record.error ?? null,
      record.createdAt,
      serializeJson(record.metadata),
    );
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to save notification delivery: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadNotificationDeliveries(limit = 200): NotificationDeliveryRecord[] {
  try {
    ensureTables();
    const rows = getGlobalDb()
      .prepare(`
        SELECT id, workflow_id, approval_request_id, channel, status, event_type, title, message, error, created_at, metadata_json
        FROM notification_deliveries_runtime
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit) as NotificationDeliveryRow[];

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id ?? undefined,
      approvalRequestId: row.approval_request_id ?? undefined,
      channel: row.channel,
      status: row.status,
      eventType: row.event_type,
      title: row.title,
      message: row.message,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      metadata: parseJson(row.metadata_json, `notification_delivery:${row.id}:metadata`),
    }));
  } catch (error) {
    logError('AutonomyRuntimeStore', `Failed to load notification deliveries: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function clearNotificationDeliveries(): void {
  ensureTables();
  getGlobalDb().prepare('DELETE FROM notification_deliveries_runtime').run();
}
