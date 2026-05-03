import crypto from 'crypto';

export interface CrmLeadInputRecord extends Record<string, unknown> {
  source?: unknown;
  payload?: unknown;
  receivedAt?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  timestamp?: unknown;
  id?: unknown;
}

export interface NormalizedCrmLead {
  id: string;
  source: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  createdAt: string;
  receivedAt: string;
  dedupeKey: string;
  raw: Record<string, unknown>;
}

export interface CrmLeadResponseContext {
  leadId: string;
  response: unknown;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = toTrimmedString(value)?.toLowerCase() ?? null;
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizePhone(value: unknown): string | null {
  const raw = toTrimmedString(value);
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

function resolveSource(raw: Record<string, unknown>, payload: Record<string, unknown>): string {
  return (
    toTrimmedString(raw.source) ??
    toTrimmedString(payload.source) ??
    toTrimmedString(payload.lead_source) ??
    toTrimmedString(raw.lead_source) ??
    'unknown'
  );
}

function resolveTimestamp(
  raw: Record<string, unknown>,
  payload: Record<string, unknown>,
  fallback: string,
): string {
  return (
    toTrimmedString(raw.receivedAt) ??
    toTrimmedString(raw.received_at) ??
    toTrimmedString(raw.timestamp) ??
    toTrimmedString(payload.receivedAt) ??
    toTrimmedString(payload.received_at) ??
    toTrimmedString(payload.createdAt) ??
    toTrimmedString(payload.created_at) ??
    toTrimmedString(payload.timestamp) ??
    fallback
  );
}

export function buildCrmDedupeKey(input: Pick<NormalizedCrmLead, 'source' | 'email' | 'phone' | 'company'>): string {
  const canonical = [
    input.source.trim().toLowerCase(),
    input.email?.trim().toLowerCase() ?? '',
    input.phone?.trim() ?? '',
    input.company?.trim().toLowerCase() ?? '',
  ].join('|');

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function normalizeCrmLead(raw: unknown): NormalizedCrmLead | null {
  if (!isRecord(raw)) return null;

  const payload = isRecord(raw.payload) ? raw.payload : raw;
  const source = resolveSource(raw, payload);
  const email = normalizeEmail(payload.email ?? payload.contact_email ?? raw.email ?? raw.contact_email);
  const phone = normalizePhone(payload.phone ?? payload.contact_phone ?? raw.phone ?? raw.contact_phone);
  const company = toTrimmedString(payload.company ?? payload.organization ?? raw.company ?? raw.organization);
  const id = toTrimmedString(raw.id ?? payload.id) ?? `crm-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const receivedAt = resolveTimestamp(raw, payload, now);
  const createdAt =
    toTrimmedString(payload.createdAt) ??
    toTrimmedString(payload.created_at) ??
    toTrimmedString(payload.timestamp) ??
    toTrimmedString(raw.createdAt) ??
    toTrimmedString(raw.created_at) ??
    toTrimmedString(raw.timestamp) ??
    receivedAt;

  const normalized: NormalizedCrmLead = {
    id,
    source,
    email,
    phone,
    company,
    createdAt,
    receivedAt,
    raw: payload,
    dedupeKey: '',
  };

  normalized.dedupeKey = buildCrmDedupeKey(normalized);
  return normalized;
}

export function normalizeCrmLeadResponse(raw: unknown, fallbackReason = 'customer response received'): CrmLeadResponseContext | null {
  if (!isRecord(raw)) return null;

  const lead = isRecord(raw.lead) ? raw.lead : raw;
  const leadId =
    toTrimmedString(raw.leadId) ??
    toTrimmedString(raw.id) ??
    toTrimmedString(lead.leadId) ??
    toTrimmedString(lead.id);

  if (!leadId) return null;

  return {
    leadId,
    response: raw.response ?? raw.message ?? raw.note ?? lead.response ?? null,
    reason: toTrimmedString(raw.reason) ?? fallbackReason,
  };
}
