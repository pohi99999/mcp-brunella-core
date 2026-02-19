/**
 * Agent Permission System
 *
 * Implements role-based access control (RBAC) for agents.
 * Prevents agents from performing unauthorized operations.
 *
 * Usage:
 * - Check permissions before file writes, deletes, or system commands
 * - Enforce "least privilege" principle
 * - Audit trail for security
 */

import { logWarn, logError } from '../utils/logger.js';
import { record } from '../core/auditLog.js';
import path from 'path';

/**
 * Permission types an agent can have
 */
export enum Permission {
    // File Operations
    READ_FILE = 'read_file',
    WRITE_FILE = 'write_file',
    DELETE_FILE = 'delete_file',

    // Directory Operations
    READ_DIR = 'read_dir',
    WRITE_DIR = 'write_dir',

    // System Operations
    RUN_COMMAND = 'run_command',
    RUN_TESTS = 'run_tests',
    GIT_OPERATIONS = 'git_operations',

    // Network Operations
    HTTP_REQUEST = 'http_request',
    BROWSER_CONTROL = 'browser_control',

    // Database Operations
    DB_READ = 'db_read',
    DB_WRITE = 'db_write',

    // Special Permissions
    ADMIN = 'admin', // Full access
}

/**
 * Path restrictions for agents
 */
export interface PathRestriction {
    allowed: string[];   // Allowed paths (glob patterns)
    denied: string[];    // Explicitly denied paths
}

/**
 * Agent permission configuration
 */
export interface AgentPermissionConfig {
    permissions: Permission[];
    pathRestrictions?: PathRestriction;
    maxRetries?: number;          // For Phoenix Protocol
    requiresSpecApproval?: boolean; // For Spec Freeze Protocol
}

/**
 * Default permission profiles for common agent roles
 */
export const PermissionProfiles: Record<string, AgentPermissionConfig> = {
    // Developer Agent - Code writing with restrictions
    DEVELOPER: {
        permissions: [
            Permission.READ_FILE,
            Permission.WRITE_FILE,
            Permission.READ_DIR,
            Permission.RUN_COMMAND,
            Permission.RUN_TESTS,
            Permission.GIT_OPERATIONS,
        ],
        pathRestrictions: {
            allowed: [
                'src/**',           // Can write to src/
                'test/**',          // Can write tests
                'build/**',         // Can write build output
            ],
            denied: [
                '.env',             // Cannot modify secrets
                'package.json',     // Cannot modify dependencies
                'conductor/**',     // Cannot modify project management
                '.git/**',          // Cannot directly modify git internals
            ]
        },
        maxRetries: 3,
        requiresSpecApproval: true,  // Must have approved spec
    },

    // Researcher Agent - Read-only knowledge access
    RESEARCHER: {
        permissions: [
            Permission.READ_FILE,
            Permission.READ_DIR,
            Permission.HTTP_REQUEST,
        ],
        pathRestrictions: {
            allowed: [
                '**/*',  // Can read everything
            ],
            denied: []
        },
    },

    // ProjectConductor - Documentation and tracks
    PROJECT_CONDUCTOR: {
        permissions: [
            Permission.READ_FILE,
            Permission.WRITE_FILE,
            Permission.READ_DIR,
            Permission.WRITE_DIR,
        ],
        pathRestrictions: {
            allowed: [
                'conductor/**',     // Can manage tracks
                'README.md',        // Can update main docs
                'CHANGELOG.md',     // Can update changelog
                '.ai/**',           // Can update agent logs
            ],
            denied: [
                'src/**',           // Cannot modify code
                'test/**',          // Cannot modify tests
            ]
        },
    },

    // Robotkéz Agent - Browser control
    ROBOTKEZ: {
        permissions: [
            Permission.BROWSER_CONTROL,
            Permission.HTTP_REQUEST,
            Permission.READ_FILE,
            Permission.WRITE_FILE,
        ],
        pathRestrictions: {
            allowed: [
                'data/screenshots/**',  // Can save screenshots
                'data/scraped/**',      // Can save scraped data
            ],
            denied: [
                'src/**',
                'conductor/**',
            ]
        },
    },

    // Evaluator Agent - Testing and auditing
    EVALUATOR: {
        permissions: [
            Permission.READ_FILE,
            Permission.READ_DIR,
            Permission.RUN_TESTS,
            Permission.RUN_COMMAND,
        ],
        pathRestrictions: {
            allowed: ['**/*'],  // Can read everything
            denied: []
        },
    },

    // Voice Agent - Multimodal interface
    VOICE: {
        permissions: [
            Permission.READ_FILE,
            Permission.HTTP_REQUEST,
        ],
        pathRestrictions: {
            allowed: ['**/*'],
            denied: []
        },
    },

    // Admin - Full access (use sparingly!)
    ADMIN: {
        permissions: [Permission.ADMIN],
        pathRestrictions: {
            allowed: ['**/*'],
            denied: []
        },
    },
};

/**
 * Permission Manager
 *
 * Centralized permission checking and enforcement.
 */
export class PermissionManager {
    private agentPermissions: Map<string, AgentPermissionConfig> = new Map();

    constructor() {
        this.initializeDefaultPermissions();
    }

    /**
     * Initialize default permissions from registry
     */
    private initializeDefaultPermissions(): void {
        // Map agent names to permission profiles
        const agentProfiles: Record<string, string> = {
            'Developer': 'DEVELOPER',
            'Researcher': 'RESEARCHER',
            'ProjectConductor': 'PROJECT_CONDUCTOR',
            'Robotkez': 'ROBOTKEZ',
            'Evaluator': 'EVALUATOR',
            'Voice': 'VOICE',
            'Orchestrator': 'ADMIN',  // Orchestrator has full access
        };

        for (const [agentName, profileName] of Object.entries(agentProfiles)) {
            const profile = PermissionProfiles[profileName];
            if (profile) {
                this.agentPermissions.set(agentName, profile);
            }
        }
    }

    /**
     * Register custom permissions for an agent
     */
    registerAgent(agentName: string, config: AgentPermissionConfig): void {
        this.agentPermissions.set(agentName, config);
    }

    /**
     * Check if agent has a specific permission
     */
    hasPermission(agentName: string, permission: Permission): boolean {
        const config = this.agentPermissions.get(agentName);
        if (!config) {
            logWarn('PermissionManager', `No permissions configured for agent: ${agentName}`);
            return false;
        }

        // ADMIN permission grants everything
        if (config.permissions.includes(Permission.ADMIN)) {
            return true;
        }

        return config.permissions.includes(permission);
    }

    /**
     * Check if agent can access a specific file path
     */
    canAccessPath(agentName: string, filePath: string, operation: 'read' | 'write' | 'delete'): boolean {
        const config = this.agentPermissions.get(agentName);
        if (!config) return false;

        // Check permission type
        const permissionMap = {
            'read': Permission.READ_FILE,
            'write': Permission.WRITE_FILE,
            'delete': Permission.DELETE_FILE,
        };

        if (!this.hasPermission(agentName, permissionMap[operation])) {
            return false;
        }

        // Check path restrictions
        if (!config.pathRestrictions) {
            return true;  // No restrictions
        }

        const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');

        // Check denied paths first
        for (const deniedPattern of config.pathRestrictions.denied) {
            if (this.matchesPattern(normalizedPath, deniedPattern)) {
                logWarn('PermissionManager', `Path denied for ${agentName}: ${filePath}`);
                return false;
            }
        }

        // Check allowed paths
        for (const allowedPattern of config.pathRestrictions.allowed) {
            if (this.matchesPattern(normalizedPath, allowedPattern)) {
                return true;
            }
        }

        logWarn('PermissionManager', `Path not in allowed list for ${agentName}: ${filePath}`);
        return false;
    }

    /**
     * Simple glob pattern matching
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')       // Escape dots
            .replace(/\*\*/g, '.*')      // ** matches anything
            .replace(/\*/g, '[^/]*')     // * matches within directory
            .replace(/\?/g, '.');        // ? matches single char

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }

    /**
     * Get agent configuration
     */
    getAgentConfig(agentName: string): AgentPermissionConfig | undefined {
        return this.agentPermissions.get(agentName);
    }

    /**
     * Audit log for denied operations
     */
    logDeniedOperation(agentName: string, operation: string, reason: string, resource: string = 'unknown'): void {
        logError('PermissionManager', `DENIED: ${agentName} attempted ${operation} - ${reason}`);

        // Integrate with audit trail
        // Using void to treat promise as fire-and-forget
        void record('DENIED', agentName, operation, resource, reason);
    }
}

// Global permission manager instance
export const globalPermissionManager = new PermissionManager();
