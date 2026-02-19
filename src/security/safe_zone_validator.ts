// Removed static fs import
// import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { logInfo, logError, logWarn } from '../utils/logger.js';

export interface SafeZone {
  name: string;
  path: string;
  permissions: ('read' | 'write' | 'delete' | 'execute' | 'append')[];
  description: string;
  max_file_size_mb: number;
  allowed_extensions: string[];
}

export interface SafeZoneConfig {
  version: string;
  description: string;
  safe_zones: SafeZone[];
  blacklist: string[];
  audit: {
    enabled: boolean;
    log_path: string;
    retention_days: number;
    log_denied_attempts: boolean;
    alert_on_suspicious_patterns: boolean;
    suspicious_patterns: string[];
  };
  rate_limiting: {
    enabled: boolean;
    max_operations_per_minute: number;
    max_operations_per_hour: number;
    burst_allowance: number;
  };
  security: {
    enforce_path_normalization: boolean;
    block_symlinks: boolean;
    verify_file_signatures: boolean;
    sandbox_mode: boolean;
  };
}

export interface AuditEntry {
  timestamp: string;
  verdict: 'ALLOWED' | 'DENIED';
  operation: 'read' | 'write' | 'delete' | 'execute' | 'append';
  path: string;
  reason: string;
  zone?: string;
  user?: string;
  metadata?: Record<string, any>;
}

export class SafeZoneValidator {
  private config: SafeZoneConfig | null = null;
  private zones: SafeZone[] = [];
  private blacklist: string[] = [];
  private operationCounts: Map<string, { minute: number; hour: number; lastReset: Date }>;
  private configPath: string;

  constructor(configPath: string = 'config/safe_zones.json') {
    this.configPath = configPath;
    this.operationCounts = new Map();
    // Config loading is now async/lazy or handled via init
  }

  // New async init method to handle FS loading
  async initialize(): Promise<void> {
    if (this.config) return;

    // Only attempt to load if in Node environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        this.config = await this.loadConfig(this.configPath);
        this.zones = this.config.safe_zones.map(z => ({
          ...z,
          path: path.resolve(z.path)
        }));
        this.blacklist = this.config.blacklist;
        logInfo('SafeZoneValidator', `Loaded config with ${this.zones.length} safe zones`);
    } else {
        logWarn('SafeZoneValidator', 'Not running in Node.js environment, Safe Zones disabled.');
    }
  }

  private async loadConfig(configPath: string): Promise<SafeZoneConfig> {
    try {
      const fs = await import('fs');
      const fullPath = path.resolve(configPath);
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      return JSON.parse(content) as SafeZoneConfig;
    } catch (error: any) {
      logError('SafeZoneValidator', `Failed to load config: ${error.message}`);
      // Return default safe config to prevent crash
      return {
          version: "1.0",
          description: "Fallback Config",
          safe_zones: [],
          blacklist: [],
          audit: { enabled: false, log_path: "", retention_days: 0, log_denied_attempts: false, alert_on_suspicious_patterns: false, suspicious_patterns: [] },
          rate_limiting: { enabled: false, max_operations_per_minute: 0, max_operations_per_hour: 0, burst_allowance: 0 },
          security: { enforce_path_normalization: true, block_symlinks: true, verify_file_signatures: false, sandbox_mode: true }
      };
    }
  }

  /**
   * Validate if a file operation is allowed
   */
  async validate(
    targetPath: string,
    operation: 'read' | 'write' | 'delete' | 'execute' | 'append',
    metadata?: Record<string, any>
  ): Promise<boolean> {
    if (!this.config) await this.initialize();
    if (!this.config || this.zones.length === 0) return false;

    // Rate limiting check
    if (this.config.rate_limiting.enabled && !this.checkRateLimit()) {
      await this.audit('DENIED', targetPath, operation, 'Rate limit exceeded', undefined, metadata);
      return false;
    }

    // Normalize path
    let normalizedPath: string;
    try {
      normalizedPath = this.config.security.enforce_path_normalization
        ? path.resolve(targetPath)
        : targetPath;
    } catch (error: any) {
      await this.audit('DENIED', targetPath, operation, 'Path normalization failed', undefined, metadata);
      return false;
    }

    // Check for suspicious patterns
    if (this.config.audit.alert_on_suspicious_patterns) {
      for (const pattern of this.config.audit.suspicious_patterns) {
        if (normalizedPath.includes(pattern)) {
          logWarn('SafeZoneValidator', `Suspicious pattern detected: ${pattern} in ${normalizedPath}`);
          await this.audit('DENIED', targetPath, operation, `Suspicious pattern: ${pattern}`, undefined, metadata);
          return false;
        }
      }
    }

    // Check blacklist
    if (this.isBlacklisted(normalizedPath)) {
      await this.audit('DENIED', targetPath, operation, 'Blacklisted file/pattern', undefined, metadata);
      return false;
    }

    // Check symlinks (if enabled)
    if (this.config.security.block_symlinks && await this.isSymlink(normalizedPath)) {
      await this.audit('DENIED', targetPath, operation, 'Symlinks are blocked', undefined, metadata);
      return false;
    }

    // Find matching safe zone
    const zone = this.findMatchingZone(normalizedPath);
    if (!zone) {
      await this.audit('DENIED', targetPath, operation, 'Outside Safe Zone boundaries', undefined, metadata);
      return false;
    }

    // Check permissions
    if (!zone.permissions.includes(operation)) {
      await this.audit('DENIED', targetPath, operation, `Permission denied in zone: ${zone.name}`, zone.name, metadata);
      return false;
    }

    // Check file extension (for write operations)
    if (operation === 'write' || operation === 'append') {
      const ext = path.extname(normalizedPath).slice(1); // Remove leading dot
      if (zone.allowed_extensions.length > 0 && !zone.allowed_extensions.includes(ext)) {
        await this.audit('DENIED', targetPath, operation, `Extension .${ext} not allowed in zone`, zone.name, metadata);
        return false;
      }
    }

    // Check file size (for write operations)
    if ((operation === 'write' || operation === 'append')) {
        const fs = await import('fs');
        try {
            const stats = await fs.promises.stat(normalizedPath);
            const sizeMB = stats.size / (1024 * 1024);
            if (sizeMB > zone.max_file_size_mb) {
                await this.audit('DENIED', targetPath, operation, `File size ${sizeMB.toFixed(2)}MB exceeds limit ${zone.max_file_size_mb}MB`, zone.name, metadata);
                return false;
            }
        } catch {
            // File doesn't exist yet, ignore size check
        }
    }

    // All checks passed
    await this.audit('ALLOWED', targetPath, operation, `Operation permitted in ${zone.name}`, zone.name, metadata);
    return true;
  }

  /**
   * Check if path matches blacklist patterns
   */
  private isBlacklisted(targetPath: string): boolean {
    const relativePath = path.relative(process.cwd(), targetPath);

    for (const pattern of this.blacklist) {
      // Exact match
      if (relativePath === pattern) {
        return true;
      }

      // Glob pattern match
      if (minimatch(relativePath, pattern, { dot: true })) {
        return true;
      }

      // Path contains pattern
      if (relativePath.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if path is a symlink
   */
  private async isSymlink(targetPath: string): Promise<boolean> {
    try {
      const fs = await import('fs');
      try {
          // Use access to check existence first to avoid errors
          await fs.promises.access(targetPath);
      } catch {
          return false;
      }

      const stats = await fs.promises.lstat(targetPath);
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /**
   * Find matching safe zone for a path
   */
  private findMatchingZone(normalizedPath: string): SafeZone | undefined {
    return this.zones.find(zone => normalizedPath.startsWith(zone.path));
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    if (!this.config) return false;

    const key = 'global'; // Can be extended to per-user rate limiting
    const now = new Date();
    const counts = this.operationCounts.get(key) || { minute: 0, hour: 0, lastReset: now };

    // Reset counters if needed
    const minutesPassed = (now.getTime() - counts.lastReset.getTime()) / 60000;
    if (minutesPassed >= 60) {
      counts.hour = 0;
      counts.minute = 0;
      counts.lastReset = now;
    } else if (minutesPassed >= 1) {
      counts.minute = 0;
      counts.lastReset = now;
    }

    // Check limits
    if (counts.minute >= this.config.rate_limiting.max_operations_per_minute) {
      logWarn('SafeZoneValidator', 'Rate limit exceeded: operations per minute');
      return false;
    }
    if (counts.hour >= this.config.rate_limiting.max_operations_per_hour) {
      logWarn('SafeZoneValidator', 'Rate limit exceeded: operations per hour');
      return false;
    }

    // Increment counters
    counts.minute++;
    counts.hour++;
    this.operationCounts.set(key, counts);

    return true;
  }

  /**
   * Write audit entry to log
   */
  private async audit(
    verdict: 'ALLOWED' | 'DENIED',
    targetPath: string,
    operation: 'read' | 'write' | 'delete' | 'execute' | 'append',
    reason: string,
    zone?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config || !this.config.audit.enabled) {
      return;
    }

    // Skip logging allowed operations if config says so
    if (verdict === 'DENIED' && !this.config.audit.log_denied_attempts) {
      return;
    }

    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      verdict,
      operation,
      path: targetPath,
      reason,
      zone,
      metadata
    };

    try {
      const fs = await import('fs');
      const logPath = path.resolve(this.config.audit.log_path);
      const logDir = path.dirname(logPath);

      // Ensure log directory exists
      try {
          await fs.promises.access(logDir);
      } catch {
          await fs.promises.mkdir(logDir, { recursive: true });
      }

      // Append to audit log
      await fs.promises.appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8');

      // Log to console for visibility
      if (verdict === 'DENIED') {
        logWarn('SafeZoneValidator', `${verdict} - ${operation} on ${targetPath}: ${reason}`);
      } else {
        logInfo('SafeZoneValidator', `${verdict} - ${operation} on ${targetPath}`);
      }
    } catch (error: any) {
      logError('SafeZoneValidator', `Failed to write audit log: ${error.message}`);
    }
  }

  /**
   * Get all configured safe zones
   */
  getSafeZones(): SafeZone[] {
    return this.zones;
  }

  /**
   * Get audit log entries (last N entries)
   */
  async getAuditLog(limit: number = 100): Promise<AuditEntry[]> {
    if (!this.config) return [];
    try {
      const fs = await import('fs');
      const logPath = path.resolve(this.config.audit.log_path);

      try {
          await fs.promises.access(logPath);
      } catch {
          return [];
      }

      const content = await fs.promises.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);

      // Get last N lines
      const recentLines = lines.slice(-limit);

      // Parse JSON entries
      return recentLines.map(line => {
        try {
          return JSON.parse(line) as AuditEntry;
        } catch {
          return null;
        }
      }).filter(entry => entry !== null) as AuditEntry[];
    } catch (error: any) {
      logError('SafeZoneValidator', `Failed to read audit log: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean old audit log entries
   */
  async cleanAuditLog(): Promise<void> {
    if (!this.config) return;
    try {
      const fs = await import('fs');
      const logPath = path.resolve(this.config.audit.log_path);

      try {
          await fs.promises.access(logPath);
      } catch {
          return;
      }

      const retentionMs = this.config.audit.retention_days * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - retentionMs);

      const content = await fs.promises.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);

      const filteredLines = lines.filter(line => {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          return new Date(entry.timestamp) > cutoffDate;
        } catch {
          return false;
        }
      });

      await fs.promises.writeFile(logPath, filteredLines.join('\n') + '\n', 'utf-8');
      logInfo('SafeZoneValidator', `Audit log cleaned: ${lines.length - filteredLines.length} old entries removed`);
    } catch (error: any) {
      logError('SafeZoneValidator', `Failed to clean audit log: ${error.message}`);
    }
  }
}

// Singleton instance
let validatorInstance: SafeZoneValidator | null = null;

/**
 * Get or create SafeZoneValidator singleton
 */
export function getSafeZoneValidator(): SafeZoneValidator {
  if (!validatorInstance) {
    validatorInstance = new SafeZoneValidator();
  }
  return validatorInstance;
}
