/**
 * Tests: NetworkPolicy (Network Access Control Engine)
 * @track sandbox_security_hardening_20260323
 * @phase Phase 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkPolicy } from '../../src/core/sandbox/networkPolicy.js';

describe('NetworkPolicy', () => {
  let policy: NetworkPolicy;

  beforeEach(() => {
    policy = new NetworkPolicy({
      mode: 'blacklist',
      whitelist: [],
      blacklist: ['*.onion', '*.evil.com', 'blocked.example.com'],
      blockMetadataEndpoints: true,
      blockPrivateNetworks: true,
      blockLocalhost: true,
      maxRequestsPerMinute: 10,
      logDenials: true,
    });
  });

  it('should allow normal domains in blacklist mode', () => {
    const result = policy.checkAccess('https://api.github.com/repos');
    expect(result.allowed).toBe(true);
  });

  it('should block blacklisted domains', () => {
    const result = policy.checkAccess('https://site.evil.com/api');
    expect(result.allowed).toBe(false);
    expect(result.rule).toBe('blacklist_deny');
  });

  it('should block .onion domains', () => {
    const result = policy.checkAccess('http://hidden.onion/secret');
    expect(result.allowed).toBe(false);
  });

  it('should block AWS metadata endpoint', () => {
    const result = policy.checkAccess('http://169.254.169.254/latest/meta-data');
    expect(result.allowed).toBe(false);
    expect(result.rule).toBe('metadata_block');
  });

  it('should block private network 10.x', () => {
    const result = policy.checkAccess('http://10.0.0.1:8080');
    expect(result.allowed).toBe(false);
    expect(result.rule).toBe('private_network');
  });

  it('should block private network 192.168.x', () => {
    const result = policy.checkAccess('http://192.168.1.1/admin');
    expect(result.allowed).toBe(false);
  });

  it('should block localhost', () => {
    const result = policy.checkAccess('http://localhost:3000');
    expect(result.allowed).toBe(false);
    expect(result.rule).toBe('localhost_block');
  });

  it('should block 127.0.0.1', () => {
    const result = policy.checkAccess('http://127.0.0.1:8080');
    expect(result.allowed).toBe(false);
  });

  it('should handle plain domain (no protocol)', () => {
    const result = policy.checkAccess('api.openai.com');
    expect(result.allowed).toBe(true);
  });

  it('should enforce rate limiting', () => {
    // 10 requests allowed per minute
    for (let i = 0; i < 10; i++) {
      expect(policy.checkAccess('https://api.rate-test.com/v1').allowed).toBe(true);
    }
    // 11th should be rate limited
    const result = policy.checkAccess('https://api.rate-test.com/v1');
    expect(result.allowed).toBe(false);
    expect(result.rule).toBe('rate_limit');
  });

  it('should handle invalid URLs gracefully', () => {
    // 'not a valid url at all!!!' gets parsed as hostname without protocol
    // This is expected behavior — plain strings are treated as hostnames
    const result = policy.checkAccess('http://[invalid]:bad');
    expect(result.allowed).toBe(false);
    expect(result.rule).toBe('parse_error');
  });

  it('should work in whitelist mode', () => {
    const whitelistPolicy = new NetworkPolicy({
      mode: 'whitelist',
      whitelist: ['api.github.com', '*.openai.com'],
      blacklist: [],
      blockMetadataEndpoints: true,
      blockPrivateNetworks: true,
      blockLocalhost: true,
      maxRequestsPerMinute: 100,
      logDenials: true,
    });

    expect(whitelistPolicy.checkAccess('https://api.github.com').allowed).toBe(true);
    expect(whitelistPolicy.checkAccess('https://api.openai.com').allowed).toBe(true);
    expect(whitelistPolicy.checkAccess('https://random-site.com').allowed).toBe(false);
  });

  it('should track denial statistics', () => {
    policy.checkAccess('http://localhost:3000');
    policy.checkAccess('https://evil.onion');
    policy.checkAccess('http://169.254.169.254');

    const stats = policy.getStats();
    expect(stats.denied).toBe(3);
    expect(stats.recentDenials.length).toBe(3);
  });

  it('should support runtime whitelist additions', () => {
    const wp = new NetworkPolicy({ mode: 'whitelist', whitelist: [], blacklist: [], blockMetadataEndpoints: false, blockPrivateNetworks: false, blockLocalhost: false, maxRequestsPerMinute: 100, logDenials: false });
    expect(wp.checkAccess('https://new-api.com').allowed).toBe(false);
    wp.addToWhitelist('new-api.com');
    expect(wp.checkAccess('https://new-api.com').allowed).toBe(true);
  });

  it('should support runtime blacklist additions', () => {
    expect(policy.checkAccess('https://newly-bad.com').allowed).toBe(true);
    policy.addToBlacklist('newly-bad.com');
    expect(policy.checkAccess('https://newly-bad.com').allowed).toBe(false);
  });
});
