import { describe, it, expect, beforeEach, vi } from 'vitest';
import { negotiationProtocol } from '../../src/core/federation/negotiationProtocol.js';
import { trustRegistry } from '../../src/core/federation/trustRegistry.js';

describe('NegotiationProtocol', () => {
  beforeEach(() => {
    negotiationProtocol.clear();
    trustRegistry.clear();
    vi.clearAllMocks();
  });

  it('should create an offer to a trusted peer', async () => {
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'e1' });
    
    const session = await negotiationProtocol.createOffer('p1', ['web_search'], { price: 10 });
    
    expect(session.sessionId).toBeDefined();
    expect(session.state).toBe('offering');
    expect(session.initialOffer.capabilities).toContain('web_search');
    expect(session.transcript.length).toBe(1);
  });

  it('should handle counter-offer from remote', async () => {
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'e1' });
    const session = await negotiationProtocol.createOffer('p1', ['web_search']);
    
    const updated = negotiationProtocol.handleCounterOffer(session.sessionId, ['web_search', 'vision'], { price: 15 });
    
    expect(updated?.state).toBe('counter_offered');
    expect(updated?.counterOffer?.modifiedCapabilities).toContain('vision');
    expect(updated?.transcript.length).toBe(2);
  });

  it('should accept negotiation', async () => {
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'e1' });
    const session = await negotiationProtocol.createOffer('p1', ['web_search']);
    
    const accepted = await negotiationProtocol.accept(session.sessionId);
    
    expect(accepted?.state).toBe('accepted');
    expect(accepted?.resolvedAt).toBeDefined();
    expect(accepted?.agreedCapabilities).toContain('web_search');
  });

  it('should reject negotiation', async () => {
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'e1' });
    const session = await negotiationProtocol.createOffer('p1', ['web_search']);
    
    const rejected = await negotiationProtocol.reject(session.sessionId, 'Too expensive');
    
    expect(rejected?.state).toBe('rejected');
    expect(rejected?.rejectionReason).toBe('Too expensive');
  });
});
