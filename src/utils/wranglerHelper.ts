/**
 * Wrangler CLI Helper - Cloudflare deployment utilities
 * - D1 database initialization & migration
 * - Worker deployment
 * - Resource management
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { logInfo, logError } from './logger.js';

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
      execSync('wrangler --version', { stdio: 'pipe' });
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
      process.env.CLOUDFLARE_API_TOKEN = apiToken;
      logInfo('WranglerHelper', 'Cloudflare API token set in environment');
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
      logInfo('WranglerHelper', `Initializing D1 database: ${databaseName}`);
      const output = execSync(`wrangler d1 create ${databaseName}`, {
        encoding: 'utf-8',
        env: { ...process.env, CLOUDFLARE_API_TOKEN: this.config.apiToken },
      });
      logInfo('WranglerHelper', `D1 database created: ${databaseName}`);
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
      if (!existsSync(schemaPath)) {
        logError('WranglerHelper', `Schema file not found: ${schemaPath}`);
        return false;
      }

      logInfo('WranglerHelper', `Running D1 migration from: ${schemaPath}`);
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      
      // Write schema to temp file and execute
      execSync(
        `wrangler d1 execute ${databaseId} --file="${schemaPath}"`,
        {
          encoding: 'utf-8',
          env: { ...process.env, CLOUDFLARE_API_TOKEN: this.config.apiToken },
        }
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
      logInfo('WranglerHelper', `Executing D1 query: ${query.slice(0, 50)}...`);
      const output = execSync(
        `wrangler d1 execute ${databaseId} --command="${query}"`,
        {
          encoding: 'utf-8',
          env: { ...process.env, CLOUDFLARE_API_TOKEN: this.config.apiToken },
        }
      );
      return JSON.parse(output);
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

      execSync('wrangler publish', {
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
      const output = execSync('wrangler d1 list', {
        encoding: 'utf-8',
        env: { ...process.env, CLOUDFLARE_API_TOKEN: this.config.apiToken },
      });
      return JSON.parse(output);
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
