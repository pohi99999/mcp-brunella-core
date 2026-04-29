import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildCrmFollowUpSchedule, scoreCrmFollowUpLead } from '@packages/utils/crmFollowUp.js';

describe('crmFollowUp helpers', () => {
  it('scores hot inbound leads and builds D+3/D+7/D+14 schedule', () => {
    const decision = scoreCrmFollowUpLead({
      id: 'lead-1',
      source: 'demo-request',
      email: 'lead@example.com',
      phone: '+36301234567',
      company: 'Acme Kft',
      status: 'new',
      receivedAt: '2026-04-05T08:00:00Z',
      createdAt: '2026-04-05T08:00:00Z',
      payload: {
        urgency: 'high',
        budget: 7500,
        timeline: 'this week',
      },
    });

    assert.equal(decision.route, 'slack');
    assert.equal(decision.tier, 'hot');
    assert.ok(decision.score >= 70);

    const schedule = buildCrmFollowUpSchedule(
      {
        id: 'lead-1',
        source: 'demo-request',
        email: 'lead@example.com',
        phone: '+36301234567',
        company: 'Acme Kft',
        status: 'new',
        receivedAt: '2026-04-05T08:00:00Z',
        createdAt: '2026-04-05T08:00:00Z',
      },
      decision,
    );

    assert.equal(schedule.length, 3);
    assert.equal(schedule[0].step, 'd3');
    assert.equal(schedule[1].step, 'd7');
    assert.equal(schedule[2].step, 'd14');
  });
});
