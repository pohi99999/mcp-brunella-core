"use strict";

/**
 * Normalizes incoming CRM lead payloads into a canonical shape used by the pipeline.
 * This is intentionally small and dependency-free so it can be unit-tested in CI easily.
 */
export function normalizeLead(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const payload = raw.payload || raw;

  const email = (payload.email || payload.contact_email || '').toString().trim().toLowerCase() || null;
  const phone = (payload.phone || payload.contact_phone || '').toString().replace(/[^0-9+]/g, '') || null;
  const company = (payload.company || payload.organization || '').toString().trim() || null;
  const source = raw.source || payload.source || 'unknown';
  const created_at = payload.created_at || payload.timestamp || new Date().toISOString();

  return {
    email: email || null,
    phone: phone || null,
    company: company || null,
    source,
    created_at,
    raw: payload
  };
}

// Named export is ESM; keep compatibility for CommonJS consumers if needed by also
// providing a default namespace when imported via interop.
export default { normalizeLead };
