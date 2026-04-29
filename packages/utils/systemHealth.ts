/**
 * systemHealth.ts - Service Health Check Utility
 *
 * Part of ProjectConductor 2.0 "Chief-of-Staff" upgrade.
 * Monitors all system services and provides unified health status.
 *
 * @module utils/systemHealth
 */

import { config } from '@packages/utils/index.js';
import { logInfo } from './logger.js';

const SOURCE = 'systemHealth';

// ============================================================================
// Types
// ============================================================================

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealth {
    name: string;
    status: ServiceStatus;
    latencyMs?: number;
    lastCheck: Date;
    error?: string;
    details?: Record<string, unknown>;
}

export interface SystemHealthReport {
    timestamp: Date;
    overallStatus: ServiceStatus;
    services: ServiceHealth[];
    summary: {
        healthy: number;
        degraded: number;
        unhealthy: number;
        unknown: number;
    };
}

export interface HealthCheckConfig {
    timeoutMs?: number;
    services?: string[];
}

// ============================================================================
// Service Definitions
// ============================================================================

interface ServiceDefinition {
    name: string;
    check: () => Promise<ServiceHealth>;
}

const SERVICES: ServiceDefinition[] = [];

/**
 * Register a service for health monitoring
 */
export function registerService(definition: ServiceDefinition): void {
    SERVICES.push(definition);
    logInfo(SOURCE, `Registered service: ${definition.name}`);
}

// ============================================================================
// Built-in Health Checks
// ============================================================================

/**
 * Check Ollama LLM service
 */
async function checkOllama(timeoutMs: number): Promise<ServiceHealth> {
    const name = 'Ollama';
    const start = Date.now();
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${baseUrl}/api/tags`, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        if (response.ok) {
            const data = await response.json() as { models?: unknown[] };
            return {
                name,
                status: 'healthy',
                latencyMs,
                lastCheck: new Date(),
                details: {
                    url: baseUrl,
                    modelsLoaded: data.models?.length || 0
                }
            };
        }

        return {
            name,
            status: 'degraded',
            latencyMs,
            lastCheck: new Date(),
            error: `HTTP ${response.status}`
        };
    } catch (error) {
        return {
            name,
            status: 'unhealthy',
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}

/**
 * Check Python FastAPI backend
 */
async function checkPythonAPI(timeoutMs: number): Promise<ServiceHealth> {
    const name = 'Python API';
    const start = Date.now();
    const baseUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${baseUrl}/health`, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        if (response.ok) {
            return {
                name,
                status: 'healthy',
                latencyMs,
                lastCheck: new Date(),
                details: { url: baseUrl }
            };
        }

        return {
            name,
            status: 'degraded',
            latencyMs,
            lastCheck: new Date(),
            error: `HTTP ${response.status}`
        };
    } catch (error) {
        return {
            name,
            status: 'unhealthy',
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}

/**
 * Check MCP Server (self)
 */
async function checkMCPServer(timeoutMs: number): Promise<ServiceHealth> {
    const name = 'MCP Server';
    const start = Date.now();
    const baseUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000';

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${baseUrl}/api/health`, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        if (response.ok) {
            const data = await response.json() as Record<string, unknown>;
            return {
                name,
                status: 'healthy',
                latencyMs,
                lastCheck: new Date(),
                details: data
            };
        }

        return {
            name,
            status: 'degraded',
            latencyMs,
            lastCheck: new Date(),
            error: `HTTP ${response.status}`
        };
    } catch {
        // Self-check might fail if we ARE the server, so mark as unknown
        return {
            name,
            status: 'unknown',
            lastCheck: new Date(),
            error: 'Self-check skipped or failed'
        };
    }
}

/**
 * Check AnythingLLM
 */
async function checkAnythingLLM(timeoutMs: number): Promise<ServiceHealth> {
    const name = 'AnythingLLM';
    const start = Date.now();
    const baseUrl = config.anythingllmBaseUrl || 'http://localhost:3001';

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${baseUrl}/api/v1/system/env-dump`, {
            signal: controller.signal,
            headers: config.anythingllmApiKey
                ? { Authorization: `Bearer ${config.anythingllmApiKey}` }
                : {}
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        if (response.ok) {
            return {
                name,
                status: 'healthy',
                latencyMs,
                lastCheck: new Date(),
                details: { url: baseUrl }
            };
        }

        return {
            name,
            status: response.status === 401 ? 'degraded' : 'unhealthy',
            latencyMs,
            lastCheck: new Date(),
            error: `HTTP ${response.status}`
        };
    } catch (error) {
        return {
            name,
            status: 'unhealthy',
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}

/**
 * Check Dashboard (Vite dev server)
 */
async function checkDashboard(timeoutMs: number): Promise<ServiceHealth> {
    const name = 'Dashboard';
    const start = Date.now();
    const baseUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(baseUrl, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        if (response.ok) {
            return {
                name,
                status: 'healthy',
                latencyMs,
                lastCheck: new Date(),
                details: { url: baseUrl }
            };
        }

        return {
            name,
            status: 'degraded',
            latencyMs,
            lastCheck: new Date(),
            error: `HTTP ${response.status}`
        };
    } catch (error) {
        return {
            name,
            status: 'unhealthy',
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}

/**
 * Check Node.js process health
 */
async function checkNodeProcess(): Promise<ServiceHealth> {
    const name = 'Node Process';
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    // Determine status based on heap usage
    let status: ServiceStatus = 'healthy';
    if (heapPercent > 90) {
        status = 'unhealthy';
    } else if (heapPercent > 75) {
        status = 'degraded';
    }

    return {
        name,
        status,
        lastCheck: new Date(),
        details: {
            heapUsedMB,
            heapTotalMB,
            heapPercent,
            uptime: Math.round(process.uptime()),
            nodeVersion: process.version
        }
    };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Run health checks on all registered services
 */
export async function checkAllServices(
    options: HealthCheckConfig = {}
): Promise<SystemHealthReport> {
    const timeoutMs = options.timeoutMs || 5000;
    logInfo(SOURCE, 'Starting health check for all services...');

    const startTime = Date.now();

    // Built-in checks
    const builtInChecks: Promise<ServiceHealth>[] = [
        checkNodeProcess(),
        checkOllama(timeoutMs),
        checkPythonAPI(timeoutMs),
        checkMCPServer(timeoutMs),
        checkAnythingLLM(timeoutMs),
        checkDashboard(timeoutMs)
    ];

    // Add registered services
    const customChecks = SERVICES.map(s => s.check());

    // Run all checks in parallel
    const results = await Promise.all([...builtInChecks, ...customChecks]);

    // Filter by requested services if specified
    let services = results;
    if (options.services && options.services.length > 0) {
        services = results.filter(s =>
            options.services!.some(name =>
                s.name.toLowerCase().includes(name.toLowerCase())
            )
        );
    }

    // Calculate summary
    const summary = {
        healthy: services.filter(s => s.status === 'healthy').length,
        degraded: services.filter(s => s.status === 'degraded').length,
        unhealthy: services.filter(s => s.status === 'unhealthy').length,
        unknown: services.filter(s => s.status === 'unknown').length
    };

    // Determine overall status
    let overallStatus: ServiceStatus = 'healthy';
    if (summary.unhealthy > 0) {
        overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
        overallStatus = 'degraded';
    } else if (summary.unknown === services.length) {
        overallStatus = 'unknown';
    }

    const duration = Date.now() - startTime;
    logInfo(SOURCE, `Health check completed in ${duration}ms. Status: ${overallStatus}`);

    return {
        timestamp: new Date(),
        overallStatus,
        services,
        summary
    };
}

/**
 * Quick check - only critical services
 */
export async function quickCheck(): Promise<{
    healthy: boolean;
    status: ServiceStatus;
    criticalServices: ServiceHealth[];
}> {
    const criticalServiceNames = ['Ollama', 'Node Process'];
    const report = await checkAllServices({
        services: criticalServiceNames,
        timeoutMs: 3000
    });

    return {
        healthy: report.overallStatus === 'healthy',
        status: report.overallStatus,
        criticalServices: report.services
    };
}

/**
 * Generate markdown report from health check results
 */
export function generateHealthReport(report: SystemHealthReport): string {
    const statusIcon = {
        healthy: '🟢',
        degraded: '🟡',
        unhealthy: '🔴',
        unknown: '⚪'
    };

    const lines: string[] = [
        '# System Health Report',
        '',
        `**Timestamp:** ${report.timestamp.toISOString()}`,
        `**Overall Status:** ${statusIcon[report.overallStatus]} ${report.overallStatus.toUpperCase()}`,
        '',
        '## Summary',
        '',
        `| Status | Count |`,
        `|--------|-------|`,
        `| Healthy | ${report.summary.healthy} |`,
        `| Degraded | ${report.summary.degraded} |`,
        `| Unhealthy | ${report.summary.unhealthy} |`,
        `| Unknown | ${report.summary.unknown} |`,
        '',
        '## Services',
        ''
    ];

    for (const service of report.services) {
        lines.push(`### ${statusIcon[service.status]} ${service.name}`);
        lines.push('');
        lines.push(`- **Status:** ${service.status}`);

        if (service.latencyMs !== undefined) {
            lines.push(`- **Latency:** ${service.latencyMs}ms`);
        }

        if (service.error) {
            lines.push(`- **Error:** ${service.error}`);
        }

        if (service.details) {
            lines.push(`- **Details:** \`${JSON.stringify(service.details)}\``);
        }

        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Check a specific service by name
 */
export async function checkService(
    serviceName: string,
    timeoutMs: number = 5000
): Promise<ServiceHealth> {
    const name = serviceName.toLowerCase();

    switch (name) {
        case 'ollama':
            return checkOllama(timeoutMs);
        case 'python':
        case 'python api':
        case 'fastapi':
            return checkPythonAPI(timeoutMs);
        case 'mcp':
        case 'mcp server':
            return checkMCPServer(timeoutMs);
        case 'anythingllm':
            return checkAnythingLLM(timeoutMs);
        case 'dashboard':
        case 'ui':
            return checkDashboard(timeoutMs);
        case 'node':
        case 'node process':
            return checkNodeProcess();
        default: {
            // Check registered services
            const registered = SERVICES.find(s =>
                s.name.toLowerCase() === name
            );
            if (registered) {
                return registered.check();
            }
            return {
                name: serviceName,
                status: 'unknown',
                lastCheck: new Date(),
                error: 'Service not found'
            };
        }
    }
}

