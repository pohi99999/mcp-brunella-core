/**
 * Unit tests for EmailTriageAgent
 * Tests email classification, auto-response, and calendar integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmailTriageAgent } from '../src/agents/EmailTriageAgent.js';

describe('EmailTriageAgent', () => {
  let agent: EmailTriageAgent;

  beforeEach(() => {
    agent = new EmailTriageAgent();
  });

  describe('Agent Metadata', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('EmailTriage');
    });

    it('should have correct capabilities', () => {
      expect(agent.capabilities).toContain('email_classification');
      expect(agent.capabilities).toContain('priority_scoring');
      expect(agent.capabilities).toContain('auto_response');
      expect(agent.capabilities).toContain('calendar_integration');
    });
  });

  describe('Email Classification', () => {
    it('should classify urgent emails', async () => {
      const task = JSON.stringify({
        emailSubject: 'URGENT: Server Down',
        emailBody: 'We need immediate assistance!',
        from: 'client@example.com',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.classification).toBe('urgent');
    });

    it('should classify meeting requests', async () => {
      const task = JSON.stringify({
        emailSubject: 'Meeting invitation for next week',
        emailBody: 'Let\'s schedule a call to discuss the project.',
        from: 'partner@company.com',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.classification).toBe('meeting_request');
    });

    it('should classify invoices', async () => {
      const task = JSON.stringify({
        emailSubject: 'Invoice #12345',
        emailBody: 'Please find attached the invoice for this month.',
        from: 'billing@supplier.com',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.classification).toBe('invoice');
    });
  });

  describe('Priority Scoring', () => {
    it('should assign high priority to urgent emails', async () => {
      const task = JSON.stringify({
        emailSubject: 'Critical: Payment Deadline Tomorrow',
        from: 'finance@company.com',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.priorityScore).toBeGreaterThanOrEqual(8);
    });

    it('should assign low priority to newsletters', async () => {
      const task = JSON.stringify({
        emailSubject: 'Weekly Newsletter - Tech Updates',
        from: 'newsletter@techblog.com',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.priorityScore).toBeLessThanOrEqual(3);
    });
  });

  describe('Auto Response', () => {
    it('should generate auto-responses for common queries', async () => {
      const task = JSON.stringify({
        emailSubject: 'Pricing inquiry',
        emailBody: 'How much does your service cost?',
        from: 'potential@client.com',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.suggestedResponse).toBeDefined();
      expect(result.data.suggestedResponse).toHaveProperty('subject');
      expect(result.data.suggestedResponse).toHaveProperty('body');
    });
  });

  describe('Calendar Integration', () => {
    it('should suggest calendar events for meeting requests', async () => {
      const task = JSON.stringify({
        emailSubject: 'Let\'s meet next Tuesday at 2 PM',
        from: 'colleague@company.com',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.calendarSuggestion).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty email body', async () => {
      const task = JSON.stringify({
        emailSubject: 'Test',
        emailBody: '',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });
  });
});
