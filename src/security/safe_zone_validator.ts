import fs from 'fs';
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
  private config: SafeZoneConfig;
  private zones: SafeZone[];
  private blacklist: string[];
  private operationCounts: Map<string, { minute: number; hour: number; lastReset: Date }>;

  constructor(configPath: string = 'config/safe_zones.json') {
    this.config = this.loadConfig(configPath);
    this.zones = this.config.safe_zones.map(z => ({
      ...z,
      path: path.resolve(z.path)
    }));
    this.blacklist = this.config.blacklist;
    this.operationCounts = new Map();

    logInfo('SafeZoneValidator', `Loaded config with ${this.zones.length} safe zones`);
  }

  private loadConfig(configPath: string): SafeZoneConfig {
    try {
      const fullPath = path.resolve(configPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content) as SafeZoneConfig;
    } catch (error: any) {
      logError('SafeZoneValidator', `Failed to load config: ${error.message}`);
      throw new Error(`SafeZoneValidator: Config load failed - ${error.message}`);
    }
  }

  /**
   * Validate if a file operation is allowed
   */
  validate(
    targetPath: string,
    operation: 'read' | 'write' | 'delete' | 'execute' | 'append',
    metadata?: Record<string, any>
  ): boolean {
    // Rate limiting check
    if (this.config.rate_limiting.enabled && !this.checkRateLimit()) {
      this.audit('DENIED', targetPath, operation, 'Rate limit exceeded', undefined, metadata);
      return false;
    }

    // Normalize path
    let normalizedPath: string;
    try {
      normalizedPath = this.config.security.enforce_path_normalization
        ? path.resolve(targetPath)
        : targetPath;
    } catch (error: any) {
      this.audit('DENIED', targetPath, operation, 'Path normalization failed', undefined, metadata);
      return false;
    }

    // Check for suspicious patterns
    if (this.config.audit.alert_on_suspicious_patterns) {
      for (const pattern of this.config.audit.suspicious_patterns) {
        if (normalizedPath.includes(pattern)) {
          logWarn('SafeZoneValidator', `Suspicious pattern detected: ${pattern} in ${normalizedPath}`);
          this.audit('DENIED', targetPath, operation, `Suspicious pattern: ${pattern}`, undefined, metadata);
          return false;
        }
      }
    }

    // Check blacklist
    if (this.isBlacklisted(normalizedPath)) {
      this.audit('DENIED', targetPath, operation, 'Blacklisted file/pattern', undefined, metadata);
      return false;
    }

    // Check symlinks (if enabled)
    if (this.config.security.block_symlinks && this.isSymlink(normalizedPath)) {
      this.audit('DENIED', targetPath, operation, 'Symlinks are blocked', undefined, metadata);
      return false;
    }

    // Find matching safe zone
    const zone = this.findMatchingZone(normalizedPath);
    if (!zone) {
      this.audit('DENIED', targetPath, operation, 'Outside Safe Zone boundaries', undefined, metadata);
      return false;
    }

    // Check permissions
    if (!zone.permissions.includes(operation)) {
      this.audit('DENIED', targetPath, operation, `Permission denied in zone: ${zone.name}`, zone.name, metadata);
      return false;
    }

    // Check file extension (for write operations)
    if (operation === 'write' || operation === 'append') {
      const ext = path.extname(normalizedPath).slice(1); // Remove leading dot
      if (zone.allowed_extensions.length > 0 && !zone.allowed_extensions.includes(ext)) {
        this.audit('DENIED', targetPath, operation, `Extension .${ext} not allowed in zone`, zone.name, metadata);
        return false;
      }
    }

    // Check file size (for write operations)
    if ((operation === 'write' || operation === 'append') && fs.existsSync(normalizedPath)) {
      const stats = fs.statSync(normalizedPath);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB > zone.max_file_size_mb) {
        this.audit('DENIED', targetPath, operation, `File size ${sizeMB.toFixed(2)}MB exceeds limit ${zone.max_file_size_mb}MB`, zone.name, metadata);
        return false;
      }
    }

    // All checks passed
    this.audit('ALLOWED', targetPath, operation, `Operation permitted in ${zone.name}`, zone.name, metadata);
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
  private isSymlink(targetPath: string): boolean {
    try {
      if (!fs.existsSync(targetPath)) {
        return false;
      }
      const stats = fs.lstatSync(targetPath);
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /**
   * Find matching safe zone for a path
   */
  private findMatchingZone(normalizedPath: string): SafeZone | undefined {
    // Sort by path length descending so the most specific (longest) zone wins
    return this.zones
      .filter(zone => normalizedPath.startsWith(zone.path))
      .sort((a, b) => b.path.length - a.path.length)[0];
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
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
  private audit(
    verdict: 'ALLOWED' | 'DENIED',
    targetPath: string,
    operation: 'read' | 'write' | 'delete' | 'execute' | 'append',
    reason: string,
    zone?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.audit.enabled) {
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
      const logPath = path.resolve(this.config.audit.log_path);
      const logDir = path.dirname(logPath);

      // Ensure log directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to audit log
      fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');

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
  getAuditLog(limit: number = 100): AuditEntry[] {
    try {
      const logPath = path.resolve(this.config.audit.log_path);
      if (!fs.existsSync(logPath)) {
        return [];
      }

      const content = fs.readFileSync(logPath, 'utf-8');
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
  cleanAuditLog(): void {
    try {
      const logPath = path.resolve(this.config.audit.log_path);
      if (!fs.existsSync(logPath)) {
        return;
      }

      const retentionMs = this.config.audit.retention_days * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - retentionMs);

      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);

      const filteredLines = lines.filter(line => {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          return new Date(entry.timestamp) > cutoffDate;
        } catch {
          return false;
        }
      });

      fs.writeFileSync(logPath, filteredLines.join('\n') + '\n', 'utf-8');
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
