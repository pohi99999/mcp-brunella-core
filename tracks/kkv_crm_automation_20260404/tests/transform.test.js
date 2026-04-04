import assert from 'node:assert/strict';
import { normalizeLead } from '../src/transform.js';

function runTests() {
  // Basic normalization
  const input = {
    payload: {
      contact_email: '  ExAMPle@Email.COM ',
      contact_phone: '(+1) 555-123-4567',
      company: ' Acme Ltd ',
      timestamp: '2026-04-04T12:00:00Z'
    },
    source: 'webhook'
  };

  const out = normalizeLead(input);

  assert.strictEqual(out.email, 'example@email.com');
  assert.strictEqual(out.phone, '+15551234567');
  assert.strictEqual(out.company, 'Acme Ltd');
  assert.strictEqual(out.source, 'webhook');
  assert.strictEqual(out.created_at, '2026-04-04T12:00:00Z');

  // Null/invalid input
  assert.strictEqual(normalizeLead(null), null);

  console.log('All transform tests passed.');
}

runTests();
