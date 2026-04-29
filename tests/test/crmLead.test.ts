import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { buildCrmDedupeKey, normalizeCrmLead, normalizeCrmLeadResponse } from '@packages/utils/crmLead.js';

describe('crmLead helpers', () => {
  it('normalizes canonical lead payloads', () => {
    const lead = normalizeCrmLead({
      source: 'webhook',
      payload: {
        contact_email: '  Lead@Example.com ',
        contact_phone: '(+36) 30 123 4567',
        company: '  Acme Kft ',
        created_at: '2026-04-05T08:00:00Z',
      },
    });

    expect(lead).not.toBeNull();
    assert.ok(lead);
    assert.equal(lead.email, 'lead@example.com');
    assert.equal(lead.phone, '+36301234567');
    assert.equal(lead.company, 'Acme Kft');
    assert.equal(lead.source, 'webhook');
    assert.equal(lead.createdAt, '2026-04-05T08:00:00Z');
    assert.equal(lead.dedupeKey, buildCrmDedupeKey(lead));
  });

  it('rejects non-object inputs', () => {
    expect(normalizeCrmLead(null)).toBeNull();
    expect(normalizeCrmLead('lead')).toBeNull();
  });

  it('normalizes lead response context', () => {
    const response = normalizeCrmLeadResponse({
      leadId: 'lead-123',
      message: 'Customer wants a callback',
      reason: 'asked for follow-up',
    });

    expect(response).not.toBeNull();
    assert.ok(response);
    assert.equal(response.leadId, 'lead-123');
    assert.equal(response.reason, 'asked for follow-up');
    assert.equal(response.response, 'Customer wants a callback');
  });
});
