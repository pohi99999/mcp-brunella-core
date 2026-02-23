/**
 * Security Events Monitor - BAS Security Sandbox Phase 3
 * 
 * Purpose: Real-time security event tracking and alerting
 * Collects data from:
 * - Audit log (permission denials)
 * - Worker Thread Pool (suspicious crashes)
 * - E2B Sandbox (escape attempts)
 * - Agent executions (anomalies)
 * 
 * @track bas_security_sandbox_20260221
 * @phase Phase 3: Audit Trail & Monitoring
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn, logError } from '../utils/logger.js';
import { getAuditDb } from './auditLog.js';

// ============================================================================
// TYPES
// ============================================================================

export type SecurityEventType =
  | 'permission_denied'
  | 'sandbox_escape_attempt'
  | 'worker_crash'
  | 'anomalous_execution'
  | 'policy_violation'
  | 'resource_quota_exceeded'
  | 'suspicious_pattern';

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  agent?: string;
  resource?: string;
  details: {
    message: string;
    metadata?: Record<string, unknown>;
    stackTrace?: string;
  };
  actionTaken?: string;
}

export interface SecurityAlertRule {
  id: string;
  name: string;
  eventType: SecurityEventType;
  severityThreshold: SecurityEventSeverity;
  threshold: number;  // Number of events within timeWindow
  timeWindow: number; // milliseconds
  action: 'log' | 'alert' | 'block';
  enabled: boolean;
}

export interface SecurityStats {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecurityEventSeverity, number>;
  last24Hours: number;
  activeAlerts: number;
}

// ============================================================================
// SECURITY EVENTS MONITOR
// ============================================================================

export class SecurityEventsMonitor extends EventEmitter {
  private events: SecurityEvent[] = [];
  private alerts: Map<string, SecurityAlertRule> = new Map();
  private eventCounts: Map<string, { count: number; firstSeen: number }> = new Map();
  private maxEventsInMemory = 1000;

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const defaultRules: SecurityAlertRule[] = [
      {
        id: 'permission-denial-spam',
        name: 'Permission Denial Spam Detection',
        eventType: 'permission_denied',
        severityThreshold: 'medium',
        threshold: 10,
        timeWindow: 60000, // 1 minute
        action: 'alert',
        enabled: true
      },
      {
        id: 'sandbox-escape-critical',
        name: 'Sandbox Escape Attempt',
        eventType: 'sandbox_escape_attempt',
        severityThreshold: 'critical',
        threshold: 1,
        timeWindow: 3600000, // 1 hour
        action: 'block',
        enabled: true
      },
      {
        id: 'worker-crash-pattern',
        name: 'Worker Crash Pattern Detection',
        eventType: 'worker_crash',
        severityThreshold: 'high',
        threshold: 5,
        timeWindow: 300000, // 5 minutes
        action: 'alert',
        enabled: true
      },
      {
        id: 'resource-quota-breach',
        name: 'Resource Quota Exceeded',
        eventType: 'resource_quota_exceeded',
        severityThreshold: 'high',
        threshold: 3,
        timeWindow: 60000, // 1 minute
        action: 'log',
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      this.alerts.set(rule.id, rule);
    }
  }

  /**
   * Record a security event
   */
  recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      ...event
    };

    // Add to in-memory storage
    this.events.push(fullEvent);

    // Trim old events
    if (this.events.length > this.maxEventsInMemory) {
      this.events = this.events.slice(-this.maxEventsInMemory);
    }

    // Check alert rules
    this.checkAlertRules(fullEvent);

    // Emit event for listeners
    this.emit('security-event', fullEvent);

    // Log based on severity
    const logMessage = `[${fullEvent.severity.toUpperCase()}] ${fullEvent.type}: ${fullEvent.details.message}`;
    
    if (fullEvent.severity === 'critical' || fullEvent.severity === 'high') {
      logError('SecurityMonitor', logMessage);
    } else if (fullEvent.severity === 'medium') {
      logWarn('SecurityMonitor', logMessage);
    } else {
      logInfo('SecurityMonitor', logMessage);
    }
  }

  private checkAlertRules(event: SecurityEvent): void {
    for (const rule of this.alerts.values()) {
      if (!rule.enabled) continue;
      if (rule.eventType !== event.type) continue;

      // Check severity threshold
      const severities: SecurityEventSeverity[] = ['low', 'medium', 'high', 'critical'];
      const eventSevIndex = severities.indexOf(event.severity);
      const thresholdIndex = severities.indexOf(rule.severityThreshold);

      if (eventSevIndex < thresholdIndex) continue;

      // Track event count within time window
      const key = `${rule.id}:${event.type}`;
      const now = Date.now();

      if (!this.eventCounts.has(key)) {
        this.eventCounts.set(key, { count: 1, firstSeen: now });
      } else {
        const tracker = this.eventCounts.get(key)!;

        // Check if we're still within the time window
        if (now - tracker.firstSeen <= rule.timeWindow) {
          tracker.count++;

          // Threshold exceeded?
          if (tracker.count >= rule.threshold) {
            this.triggerAlert(rule, event, tracker.count);
            
            // Reset tracker after alert
            this.eventCounts.delete(key);
          }
        } else {
          // Time window expired, reset
          this.eventCounts.set(key, { count: 1, firstSeen: now });
        }
      }
    }
  }

  private triggerAlert(rule: SecurityAlertRule, event: SecurityEvent, count: number): void {
    const alert = {
      ruleId: rule.id,
      ruleName: rule.name,
      triggeredBy: event,
      count,
      action: rule.action,
      timestamp: new Date().toISOString()
    };

    logError('SecurityMonitor', `🚨 ALERT: ${rule.name} triggered (${count} events)`);
    
    // Emit alert event
    this.emit('security-alert', alert);

    // Take action based on rule
    switch (rule.action) {
      case 'log':
        // Already logged above
        break;
      
      case 'alert':
        // TODO: Send notification (email, Slack, etc.)
        logWarn('SecurityMonitor', `Alert notification should be sent for: ${rule.name}`);
        break;
      
      case 'block':
        // TODO: Implement blocking mechanism
        logError('SecurityMonitor', `Blocking action required for: ${rule.name}`);
        if (event.agent) {
          this.emit('block-agent', event.agent);
        }
        break;
    }
  }

  /**
   * Get security statistics
   */
  getStats(): SecurityStats {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;

    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    let last24HoursCount = 0;

    for (const event of this.events) {
      const eventTime = new Date(event.timestamp).getTime();

      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

      // Count last 24 hours
      if (eventTime >= last24Hours) {
        last24HoursCount++;
      }
    }

    return {
      totalEvents: this.events.length,
      eventsByType: eventsByType as Record<SecurityEventType, number>,
      eventsBySeverity: eventsBySeverity as Record<SecurityEventSeverity, number>,
      last24Hours: last24HoursCount,
      activeAlerts: Array.from(this.alerts.values()).filter(r => r.enabled).length
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clear all events (for testing)
   */
  clearEvents(): void {
    this.events = [];
    this.eventCounts.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalMonitor: SecurityEventsMonitor | null = null;

export function getSecurityMonitor(): SecurityEventsMonitor {
  if (!globalMonitor) {
    globalMonitor = new SecurityEventsMonitor();
    logInfo('SecurityMonitor', 'Security Events Monitor initialized');
  }

  return globalMonitor;
}
