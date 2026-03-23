/**
 * Network Policy Engine — URL & Domain Access Control
 *
 * Provides whitelist/blacklist-based network access control for sandbox
 * and agent operations. Blocks metadata endpoints, internal IPs, and
 * unauthorized domains.
 *
 * @track sandbox_security_hardening_20260323
 * @phase Phase 2: Network Isolation
 */

import { logInfo, logWarn } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export type PolicyMode = 'whitelist' | 'blacklist';

export interface NetworkPolicyConfig {
  mode: PolicyMode;
  whitelist: string[];       // Allowed domain patterns
  blacklist: string[];       // Blocked domain patterns
  blockMetadataEndpoints: boolean;
  blockPrivateNetworks: boolean;
  blockLocalhost: boolean;
  maxRequestsPerMinute: number;
  logDenials: boolean;
}

export interface NetworkCheckResult {
  allowed: boolean;
  reason: string;
  rule?: string;
  url: string;
}

interface RequestTracker {
  count: number;
  windowStart: number;
}

// Default blocked IP ranges (metadata endpoints, private networks)
const METADATA_PATTERNS = [
  /^169\.254\./,                    // AWS/Azure metadata
  /^100\.100\.100\.200/,            // Alibaba metadata
  /^fd00:/i,                        // IPv6 ULA
  /metadata\.google\.internal/i,
  /metadata\.azure\.internal/i,
];

const PRIVATE_NETWORK_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const LOCALHOST_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^::1$/,
  /^0\.0\.0\.0$/,
];

const DEFAULT_CONFIG: NetworkPolicyConfig = {
  mode: 'blacklist',
  whitelist: [],
  blacklist: [
    '*.onion',
    '*.i2p',
    '*.local',
  ],
  blockMetadataEndpoints: true,
  blockPrivateNetworks: true,
  blockLocalhost: true,
  maxRequestsPerMinute: 100,
  logDenials: true,
};

// ============================================================================
// NETWORK POLICY ENGINE
// ============================================================================

export class NetworkPolicy {
  private config: NetworkPolicyConfig;
  private requestTrackers = new Map<string, RequestTracker>();
  private denialLog: NetworkCheckResult[] = [];
  private stats = {
    totalChecks: 0,
    allowed: 0,
    denied: 0,
    rateLimited: 0,
  };

  constructor(config?: Partial<NetworkPolicyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Load policy from JSON config file
   */
  static fromFile(filePath: string): NetworkPolicy {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(raw) as Partial<NetworkPolicyConfig>;
      logInfo('[NetworkPolicy]', `Loaded policy from ${path.basename(filePath)}`);
      return new NetworkPolicy(config);
    } catch {
      logWarn('[NetworkPolicy]', `Failed to load ${filePath}, using defaults`);
      return new NetworkPolicy();
    }
  }

  /**
   * Check if a URL/domain is allowed by the policy
   */
  checkAccess(urlOrDomain: string): NetworkCheckResult {
    this.stats.totalChecks++;
    let hostname: string;
    let fullUrl = urlOrDomain;

    try {
      // Try to parse as URL
      if (urlOrDomain.includes('://')) {
        const parsed = new URL(urlOrDomain);
        hostname = parsed.hostname;
      } else {
        hostname = urlOrDomain.split(':')[0]; // strip port
        fullUrl = `https://${urlOrDomain}`;
      }
    } catch {
      this.stats.denied++;
      return this.deny(fullUrl, 'Invalid URL format', 'parse_error');
    }

    // 1. Block metadata endpoints
    if (this.config.blockMetadataEndpoints) {
      for (const pattern of METADATA_PATTERNS) {
        if (pattern.test(hostname)) {
          this.stats.denied++;
          return this.deny(fullUrl, 'Metadata endpoint blocked', 'metadata_block');
        }
      }
    }

    // 2. Block private networks
    if (this.config.blockPrivateNetworks) {
      for (const pattern of PRIVATE_NETWORK_PATTERNS) {
        if (pattern.test(hostname)) {
          this.stats.denied++;
          return this.deny(fullUrl, 'Private network blocked', 'private_network');
        }
      }
    }

    // 3. Block localhost
    if (this.config.blockLocalhost) {
      for (const pattern of LOCALHOST_PATTERNS) {
        if (pattern.test(hostname)) {
          this.stats.denied++;
          return this.deny(fullUrl, 'Localhost access blocked', 'localhost_block');
        }
      }
    }

    // 4. Rate limiting per hostname
    if (!this.checkRateLimit(hostname)) {
      this.stats.rateLimited++;
      this.stats.denied++;
      return this.deny(fullUrl, `Rate limit exceeded: ${this.config.maxRequestsPerMinute}/min`, 'rate_limit');
    }

    // 5. Apply whitelist/blacklist policy
    if (this.config.mode === 'whitelist') {
      // Only whitelisted domains allowed
      if (this.matchesPatternList(hostname, this.config.whitelist)) {
        this.stats.allowed++;
        return { allowed: true, reason: 'Whitelisted', url: fullUrl };
      }
      this.stats.denied++;
      return this.deny(fullUrl, 'Not in whitelist', 'whitelist_deny');
    }

    // Blacklist mode: everything allowed except blacklisted
    if (this.matchesPatternList(hostname, this.config.blacklist)) {
      this.stats.denied++;
      return this.deny(fullUrl, 'Domain blacklisted', 'blacklist_deny');
    }

    this.stats.allowed++;
    return { allowed: true, reason: 'Allowed by policy', url: fullUrl };
  }

  /**
   * Get policy statistics
   */
  getStats() {
    return {
      ...this.stats,
      mode: this.config.mode,
      whitelistCount: this.config.whitelist.length,
      blacklistCount: this.config.blacklist.length,
      recentDenials: this.denialLog.slice(-20),
    };
  }

  /**
   * Get recent denial log
   */
  getDenials(limit = 50): NetworkCheckResult[] {
    return this.denialLog.slice(-limit);
  }

  /**
   * Add domain to whitelist at runtime
   */
  addToWhitelist(pattern: string): void {
    if (!this.config.whitelist.includes(pattern)) {
      this.config.whitelist.push(pattern);
      logInfo('[NetworkPolicy]', `Added to whitelist: ${pattern}`);
    }
  }

  /**
   * Add domain to blacklist at runtime
   */
  addToBlacklist(pattern: string): void {
    if (!this.config.blacklist.includes(pattern)) {
      this.config.blacklist.push(pattern);
      logInfo('[NetworkPolicy]', `Added to blacklist: ${pattern}`);
    }
  }

  /**
   * Export current config
   */
  getConfig(): NetworkPolicyConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private deny(url: string, reason: string, rule: string): NetworkCheckResult {
    const result: NetworkCheckResult = { allowed: false, reason, rule, url };
    if (this.config.logDenials) {
      this.denialLog.push(result);
      // Keep log bounded
      if (this.denialLog.length > 1000) {
        this.denialLog = this.denialLog.slice(-500);
      }
    }
    return result;
  }

  private matchesPatternList(hostname: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (this.matchGlob(hostname, pattern)) {
        return true;
      }
    }
    return false;
  }

  private matchGlob(hostname: string, pattern: string): boolean {
    // Convert glob to regex: *.example.com → (.+\.)?example\.com
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`, 'i');
    return regex.test(hostname);
  }

  private checkRateLimit(hostname: string): boolean {
    const now = Date.now();
    const tracker = this.requestTrackers.get(hostname);

    if (!tracker || now - tracker.windowStart > 60_000) {
      this.requestTrackers.set(hostname, { count: 1, windowStart: now });
      return true;
    }

    tracker.count++;
    return tracker.count <= this.config.maxRequestsPerMinute;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultPolicy: NetworkPolicy | null = null;

export function getNetworkPolicy(): NetworkPolicy {
  if (!defaultPolicy) {
    const configPath = path.join(process.cwd(), 'config', 'security', 'network-policy.json');
    defaultPolicy = NetworkPolicy.fromFile(configPath);
  }
  return defaultPolicy;
}

export function resetNetworkPolicy(): void {
  defaultPolicy = null;
}
