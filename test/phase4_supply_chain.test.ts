/**
 * Phase 4 Supply Chain Track - Integration Tests
 * Tests: Gmail draft template, Human-in-the-loop approval flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogisticsDispatcher } from '../src/agents/LogisticsDispatcher.js';

describe('Phase 4: Supply Chain - Draft & Approval Workflow', () => {
  let agent: LogisticsDispatcher;

  beforeEach(() => {
    agent = new LogisticsDispatcher();
  });

  it('should create outreach draft email', async () => {
    const result = await agent.execute('create outreach draft', {
      partners: [
        { name: 'TIMOCOM', email: 'test1@example.com' },
        { name: 'Trans.eu', email: 'test2@example.com' }
      ],
      matchData: {
        summary: { matches: 5, avg_score: 8.5 }
      }
    });

    expect(result.status).toBe('success');
    expect(result.data).toHaveProperty('draftId');
    expect(result.data).toHaveProperty('recipients');
    expect((result.data as any).recipients).toHaveLength(2);
    expect((result.data as any).requiresApproval).toBe(true);
  });

  it('should require approval before sending draft', async () => {
    // Step 1: Create draft
    const draftResult = await agent.execute('create draft', {
      partners: [{ name: 'Test Partner', email: 'test@example.com' }]
    });

    expect(draftResult.status).toBe('success');
    const draftId = (draftResult.data as any).draftId;

    // Step 2: Try to send WITHOUT approval - should fail
    const sendResult = await agent.execute('send email', { draftId });
    expect(sendResult.status).toBe('error');
    expect(sendResult.error).toContain('nincs jóváhagyva');
  });

  it('should allow sending only AFTER approval (Human-in-the-loop)', async () => {
    // Step 1: Create draft
    const draftResult = await agent.execute('create draft', {
      partners: [{ name: 'Test Partner', email: 'test@example.com' }]
    });
    const draftId = (draftResult.data as any).draftId;

    // Step 2: Approve draft (Human action)
    const approveResult = await agent.execute('approve draft', { draftId });
    expect(approveResult.status).toBe('success');
    expect((approveResult.data as any).approvedAt).toBeDefined();

    // Step 3: Send approved draft - should succeed
    const sendResult = await agent.execute('send email', { draftId });
    expect(sendResult.status).toBe('success');
    expect(sendResult.message).toContain('sikeresen elküldve');
    expect((sendResult.data as any).sentAt).toBeDefined();
  });

  it('should prevent double-sending of approved draft', async () => {
    // Step 1-3: Create, approve, send
    const draftResult = await agent.execute('create draft', {
      partners: [{ name: 'Test', email: 'test@example.com' }]
    });
    const draftId = (draftResult.data as any).draftId;
    
    await agent.execute('approve draft', { draftId });
    const firstSend = await agent.execute('send email', { draftId });
    expect(firstSend.status).toBe('success');

    // Step 4: Try to send again - should fail
    const secondSend = await agent.execute('send email', { draftId });
    expect(secondSend.status).toBe('error');
    expect(secondSend.error).toContain('már el lett küldve');
  });

  it('should integrate with route optimization and matching', async () => {
    // Phase 2-3 integration: Match → Optimize → Outreach
    
    // Step 1: Match capacity
    const matchResult = await agent.execute('match capacity mock', { mock: true });
    expect(matchResult.status).toBe('success');

    // Step 2: Optimize route
    const routeResult = await agent.execute('optimize route mock', { 
      mock: true,
      locations: []
    });
    expect(routeResult.status).toBe('success');

    // Step 3: Create outreach draft with match data
    const draftResult = await agent.execute('create draft', {
      matchData: matchResult.data
    });
    expect(draftResult.status).toBe('success');
    expect(draftResult.message).toContain('Jóváhagyásra vár');
  });
});
