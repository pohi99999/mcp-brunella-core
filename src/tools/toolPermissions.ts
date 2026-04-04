// FILE: src/tools/toolPermissions.ts
// PURPOSE: Permission checking wrapper for MCP tools

import { globalPermissionManager, Permission } from '../agents/permissions.js';
import { logError, logWarn } from '../utils/logger.js';

export interface ToolExecutionContext {
    agentName?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Permission requirements for MCP tools
 */
export const ToolPermissionMap: Record<string, Permission[]> = {
    // Agent orchestration meta-tools
    'agent_delegate': [],
    'agent_execute': [],
    'ping': [],

    // Browser Tools
    'harvest_scenario': [Permission.BROWSER_CONTROL, Permission.HTTP_REQUEST],
    'harvest_extract': [Permission.BROWSER_CONTROL, Permission.HTTP_REQUEST],
    'browser_navigate': [Permission.BROWSER_CONTROL, Permission.HTTP_REQUEST],
    'browser_screenshot': [Permission.BROWSER_CONTROL],

    // System Tools
    'run_command': [Permission.RUN_COMMAND],
    'run_tests': [Permission.RUN_TESTS],

    // Database Tools (SQLite)
    'sqlite_query': [Permission.DB_READ],
    'sqlite_execute': [Permission.DB_WRITE],

    // File Tools
    'read_file': [Permission.READ_FILE],
    'write_file': [Permission.WRITE_FILE],
    'delete_file': [Permission.DELETE_FILE],

    // Git Tools
    'git_commit': [Permission.GIT_OPERATIONS],
    'git_push': [Permission.GIT_OPERATIONS],
    'git_pull': [Permission.GIT_OPERATIONS],

    // HTTP Tools
    'http_request': [Permission.HTTP_REQUEST],
    'web_search': [Permission.HTTP_REQUEST],

    // EV Hunter Tools
    'ev_hunter_search': [Permission.BROWSER_CONTROL],
    'ev_hunter_status': [Permission.READ_FILE],

};

/**
 * Check if agent has permission to execute tool
 */
export function checkToolPermission(
    toolName: string,
    context: ToolExecutionContext
): { allowed: boolean; reason?: string } {
    const agentName = context.agentName;

    // If no agent context, allow by default (manual CLI calls)
    if (!agentName) {
        return { allowed: true };
    }

    // Get required permissions for tool
    const requiredPermissions = ToolPermissionMap[toolName];

    // If tool not in map, deny for non-admin agents instead of failing open.
    if (!requiredPermissions) {
        if (globalPermissionManager.hasPermission(agentName, Permission.ADMIN)) {
            logWarn('ToolPermissions', `Tool ${toolName} not in permission map - allowing for admin agent ${agentName}`);
            return { allowed: true };
        }

        const reason = `Tool ${toolName} is not explicitly allowlisted for agent ${agentName}`;
        globalPermissionManager.logDeniedOperation(agentName, `tool:${toolName}`, reason, toolName);
        return { allowed: false, reason };
    }

    // Check each required permission
    for (const permission of requiredPermissions) {
        if (!globalPermissionManager.hasPermission(agentName, permission)) {
            const reason = `Agent ${agentName} lacks ${permission} permission for ${toolName}`;
            globalPermissionManager.logDeniedOperation(agentName, `tool:${toolName}`, reason, toolName);
            return { allowed: false, reason };
        }
    }

    return { allowed: true };
}

/**
 * Path-based permission check for file operations
 */
export function checkFilePermission(
    agentName: string | undefined,
    filePath: string,
    operation: 'read' | 'write' | 'delete'
): { allowed: boolean; reason?: string } {
    if (!agentName) {
        return { allowed: true };
    }

    if (!globalPermissionManager.canAccessPath(agentName, filePath, operation)) {
        const reason = `Agent ${agentName} cannot ${operation} file: ${filePath}`;
        globalPermissionManager.logDeniedOperation(agentName, `file:${operation}`, reason, filePath);
        return { allowed: false, reason };
    }

    return { allowed: true };
}
