/**
 * Unit tests for LogisticsDispatcherAgent
 * Tests shipment tracking, route optimization, and carrier coordination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogisticsDispatcherAgent } from '../src/agents/LogisticsDispatcherAgent.js';

describe('LogisticsDispatcherAgent', () => {
  let agent: LogisticsDispatcherAgent;

  beforeEach(() => {
    agent = new LogisticsDispatcherAgent();
  });

  describe('Agent Metadata', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('LogisticsDispatcher');
    });

    it('should have correct capabilities', () => {
      expect(agent.capabilities).toContain('shipment_tracking');
      expect(agent.capabilities).toContain('route_optimization');
      expect(agent.capabilities).toContain('carrier_coordination');
      expect(agent.capabilities).toContain('delay_prediction');
    });
  });

  describe('Shipment Tracking', () => {
    it('should track shipment status', async () => {
      const task = JSON.stringify({
        trackingNumber: 'SHIP-2026-001',
        carrier: 'GLS',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.shipmentStatus).toBeDefined();
      expect(result.data.shipmentStatus).toHaveProperty('currentLocation');
      expect(result.data.shipmentStatus).toHaveProperty('estimatedDelivery');
    });

    it('should handle multiple shipments', async () => {
      const task = JSON.stringify({
        trackingNumbers: ['SHIP-001', 'SHIP-002', 'SHIP-003'],
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.shipments).toBeDefined();
      expect(Array.isArray(result.data.shipments)).toBe(true);
    });
  });

  describe('Route Optimization', () => {
    it('should optimize delivery routes', async () => {
      const task = JSON.stringify({
        destinations: [
          { city: 'Budapest', address: 'Váci út 1.' },
          { city: 'Debrecen', address: 'Piac utca 5.' },
          { city: 'Szeged', address: 'Kárász utca 10.' },
        ],
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.optimizedRoute).toBeDefined();
      expect(result.data.optimizedRoute.totalDistance).toBeDefined();
      expect(result.data.optimizedRoute.estimatedTime).toBeDefined();
    });

    it('should minimize delivery time', async () => {
      const task = JSON.stringify({
        destinations: [
          { city: 'Pécs' },
          { city: 'Győr' },
        ],
        priority: 'time',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.optimizedRoute).toBeDefined();
    });
  });

  describe('Carrier Coordination', () => {
    it('should coordinate with multiple carriers', async () => {
      const task = JSON.stringify({
        shipmentType: 'fragile',
        weight: 50,
        destination: 'Budapest',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.recommendedCarrier).toBeDefined();
      expect(result.data.estimatedCost).toBeDefined();
    });

    it('should compare carrier prices', async () => {
      const task = JSON.stringify({
        shipmentType: 'standard',
        weight: 20,
        destination: 'Szeged',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.carrierComparison).toBeDefined();
    });
  });

  describe('Delay Prediction', () => {
    it('should predict potential delays', async () => {
      const task = JSON.stringify({
        trackingNumber: 'SHIP-DELAYED-001',
        carrier: 'MPL',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.delayPrediction).toBeDefined();
      expect(result.data.delayPrediction).toHaveProperty('probability');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tracking number', async () => {
      const task = JSON.stringify({
        trackingNumber: 'INVALID',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });
  });
});
