// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { kkvCrmService } from '../../src/server/services/kkvCrmService.js';

describe('kkvCrmService', () => {
  it('createLead returns stubbed lead object', async () => {
    const payload = { name: 'Acme Kft', email: 'contact@acme.example' };
    const res = await kkvCrmService.createLead(payload);
    expect(res).toBeTruthy();
    expect(res.success).toBe(true);
    expect(res.leadId).toBeDefined();
    expect(res.payload).toEqual(payload);
  });
});
