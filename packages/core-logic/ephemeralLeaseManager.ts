export type EphemeralBudgetType = 'token' | 'cost' | 'step';
export type EphemeralBudgetStatus = 'healthy' | 'exceeded' | 'awaiting_approval';
export type EphemeralBudgetExceededAction = 'terminate' | 'require_approval';

export interface EphemeralLeasePolicy {
  onBudgetExceeded?: EphemeralBudgetExceededAction;
  maxRenewals?: number;
  approvalExtensionMs?: number;
  resetBudgetsOnRenew?: boolean;
  gracefulShutdownMs?: number;
}

export interface EphemeralLeaseState {
  ttlMs: number;
  expiresAt: string;
  renewalsUsed: number;
  maxRenewals: number;
  budgetStatus: EphemeralBudgetStatus;
  lastBudgetType?: EphemeralBudgetType;
  lastBudgetExceededAt?: string;
}

export interface EphemeralLeaseSpecLike {
  ttlMs?: number;
  leasePolicy?: EphemeralLeasePolicy;
}

export function createInitialLeaseState(
  spec: EphemeralLeaseSpecLike,
  nowIso: string,
  defaultTtlMs: number,
): EphemeralLeaseState {
  const ttlMs = spec.ttlMs ?? defaultTtlMs;
  const expiresAt = new Date(Date.parse(nowIso) + ttlMs).toISOString();

  return {
    ttlMs,
    expiresAt,
    renewalsUsed: 0,
    maxRenewals: spec.leasePolicy?.maxRenewals ?? 1,
    budgetStatus: 'healthy',
  };
}

export function resolveBudgetExceededAction(
  spec: EphemeralLeaseSpecLike,
): EphemeralBudgetExceededAction {
  return spec.leasePolicy?.onBudgetExceeded ?? 'terminate';
}

export function canRequestBudgetApproval(
  lease: Pick<EphemeralLeaseState, 'renewalsUsed' | 'maxRenewals'>,
): boolean {
  return lease.renewalsUsed < lease.maxRenewals;
}

export function markBudgetExceeded(
  lease: EphemeralLeaseState,
  budgetType: EphemeralBudgetType,
  nowIso: string,
  status: EphemeralBudgetStatus,
): EphemeralLeaseState {
  return {
    ...lease,
    budgetStatus: status,
    lastBudgetType: budgetType,
    lastBudgetExceededAt: nowIso,
  };
}

export function renewLease(
  lease: EphemeralLeaseState,
  spec: EphemeralLeaseSpecLike,
  nowIso: string,
): EphemeralLeaseState {
  const extensionMs = spec.leasePolicy?.approvalExtensionMs ?? lease.ttlMs;

  return {
    ttlMs: extensionMs,
    expiresAt: new Date(Date.parse(nowIso) + extensionMs).toISOString(),
    renewalsUsed: lease.renewalsUsed + 1,
    maxRenewals: lease.maxRenewals,
    budgetStatus: 'healthy',
  };
}

export function shouldResetBudgetsOnRenew(spec: EphemeralLeaseSpecLike): boolean {
  return spec.leasePolicy?.resetBudgetsOnRenew ?? true;
}