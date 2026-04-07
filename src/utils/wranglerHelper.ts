/**
 * Wrangler CLI Helper - Cloudflare deployment utilities
 * - D1 database initialization & migration
 * - Worker deployment
 * - Resource management
 */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { logInfo, logError } from './logger.js';
import { getBasCloudflareApiToken } from './cloudflareConfig.js';
import { safeJsonParse } from './aiHelpers.js';

/**
 * Validates that a value is a safe Cloudflare resource identifier.
 * Only alphanumerics, hyphens and underscores are permitted.
 * Prevents OS-command injection when values are passed as CLI arguments.
 */
function sanitizeIdentifier(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". Only alphanumeric characters, hyphens and underscores are allowed.`,
    );
  }
  return value;
}

/**
 * Validates that schemaPath resolves to a location inside the project root.
 * Prevents relative/absolute path traversal (CWE-22, CWE-23, CWE-36).
 */
function validateSchemaPath(schemaPath: string): string {
  const resolved = path.resolve(schemaPath);
  const projectRoot = process.cwd();
  if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
    throw new Error(
      `Schema path "${schemaPath}" is outside the project directory. Path traversal is not permitted.`,
    );
  }
  return resolved;
}

export interface WranglerConfig {
  projectName: string;
  accountId: string;
  apiToken: string;
  d1DatabaseId?: string;
  workerScript?: string;
}

export class WranglerHelper {
  private config: WranglerConfig;
  private wranglerConfigPath: string;

  constructor(config: WranglerConfig) {
    this.config = config;
    this.wranglerConfigPath = path.join(process.cwd(), 'wrangler.toml');
  }

  /**
   * Check if Wrangler CLI is installed
   */
  async checkWranglerInstalled(): Promise<boolean> {
    try {
      execFileSync('wrangler', ['--version'], { stdio: 'pipe' });
      logInfo('WranglerHelper', 'Wrangler CLI is installed');
      return true;
    } catch (e: unknown) {
      logError('WranglerHelper', 'Wrangler CLI not installed. Run: npm install -g wrangler');
      return false;
    }
  }

  /**
   * Authenticate Wrangler with Cloudflare API token
   */
  async authenticate(apiToken: string): Promise<boolean> {
    try {
      process.env.CF_BAS_API_TOKEN = apiToken;
      process.env.CLOUDFLARE_API_TOKEN = apiToken;
      process.env.CF_API_TOKEN = apiToken;
      logInfo('WranglerHelper', 'Cloudflare BAS API token set in environment');
      return true;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerHelper', `Authentication failed: ${error}`);
      return false;
    }
  }

  /**
   * Initialize D1 database
   * Command: wrangler d1 create <database-name>
   */
  async initializeD1(databaseName: string): Promise<string | null> {
    try {
      const safeName = sanitizeIdentifier(databaseName, 'databaseName');
      logInfo('WranglerHelper', `Initializing D1 database: ${safeName}`);
      const output = execFileSync('wrangler', ['d1', 'create', safeName], {
        encoding: 'utf-8',
        env: {
          ...process.env,
          CF_BAS_API_TOKEN: this.config.apiToken,
          CLOUDFLARE_API_TOKEN: this.config.apiToken,
          CF_API_TOKEN: this.config.apiToken,
        },
      });
      logInfo('WranglerHelper', `D1 database created: ${safeName}`);
      return output;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerHelper', `D1 initialization failed: ${error}`);
      return null;
    }
  }

  /**
   * Run D1 migrations (applies schema)
   * Command: wrangler d1 execute <database-id> < schema.sql
   */
  async runD1Migration(databaseId: string, schemaPath: string): Promise<boolean> {
    try {
      const safeId = sanitizeIdentifier(databaseId, 'databaseId');
      const safePath = validateSchemaPath(schemaPath);

      if (!existsSync(safePath)) {
        logError('WranglerHelper', `Schema file not found: ${safePath}`);
        return false;
      }

      logInfo('WranglerHelper', `Running D1 migration from: ${safePath}`);
      execFileSync(
        'wrangler',
        ['d1', 'execute', safeId, `--file=${safePath}`],
        {
          encoding: 'utf-8',
          env: {
            ...process.env,
            CF_BAS_API_TOKEN: this.config.apiToken,
            CLOUDFLARE_API_TOKEN: this.config.apiToken,
            CF_API_TOKEN: this.config.apiToken,
          },
        },
      );

      logInfo('WranglerHelper', 'D1 migration completed successfully');
      return true;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerHelper', `D1 migration failed: ${error}`);
      return false;
    }
  }

  /**
   * Execute a D1 query
   * Command: wrangler d1 execute <database-id> --command="SELECT ..."
   */
  async executeD1Query(databaseId: string, query: string): Promise<unknown | null> {
    try {
      const safeId = sanitizeIdentifier(databaseId, 'databaseId');
      logInfo('WranglerHelper', `Executing D1 query: ${query.slice(0, 50)}...`);
      // Pass --command as a separate argument — execFileSync never invokes a shell,
      // so the query value cannot cause command injection.
      const output = execFileSync(
        'wrangler',
        ['d1', 'execute', safeId, '--command', query],
        {
          encoding: 'utf-8',
          env: {
            ...process.env,
            CF_BAS_API_TOKEN: this.config.apiToken,
            CLOUDFLARE_API_TOKEN: this.config.apiToken,
            CF_API_TOKEN: this.config.apiToken,
          },
        },
      );
      return safeJsonParse<any>(output, null);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerHelper', `D1 query failed: ${error}`);
      return null;
    }
  }

  /**
   * Publish Cloudflare Worker
   * Command: wrangler publish
   */
  async publishWorker(): Promise<boolean> {
    try {
      logInfo('WranglerHelper', 'Publishing Cloudflare Worker...');
      
      if (!existsSync(this.wranglerConfigPath)) {
        logError('WranglerHelper', `wrangler.toml not found at ${this.wranglerConfigPath}`);
        return false;
      }

      execFileSync('wrangler', ['publish'], {
        cwd: process.cwd(),
        env: { ...process.env, CLOUDFLARE_API_TOKEN: this.config.apiToken },
      });

      logInfo('WranglerHelper', 'Worker published successfully');
      return true;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerHelper', `Worker publishing failed: ${error}`);
      return false;
    }
  }

  /**
   * Get list of D1 databases
   */
  async listD1Databases(): Promise<unknown | null> {
    try {
      logInfo('WranglerHelper', 'Listing D1 databases...');
      const output = execFileSync('wrangler', ['d1', 'list'], {
        encoding: 'utf-8',
        env: { ...process.env, CLOUDFLARE_API_TOKEN: this.config.apiToken },
      });
      return safeJsonParse<any>(output, null);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerHelper', `Listing D1 databases failed: ${error}`);
      return null;
    }
  }
}

/**
 * Singleton instance
 */
let instance: WranglerHelper | null = null;

export function initializeWrangler(config: WranglerConfig): WranglerHelper {
  if (!instance) {
    instance = new WranglerHelper(config);
  }
  return instance;
}

export function getWrangler(): WranglerHelper | null {
  return instance;
}
