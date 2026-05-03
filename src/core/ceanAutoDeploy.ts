import { WranglerHelper } from '../utils/wranglerHelper.js';
import { logInfo, logError } from '../utils/logger.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

/**
 * CEAN AutoDeploy - Automates D1 schema to Worker synchronization
 * 
 * Flow:
 * 1. Checks for D1 schema changes
 * 2. Applies migrations to D1
 * 3. Updates Worker code if necessary (Environment bindings/Types)
 * 4. Deploys Worker to Cloudflare
 */

export interface AutoDeployConfig {
  workerDir: string;
  schemaPath: string;
  databaseId: string;
  apiToken: string;
  projectName: string;
}

export interface AutoDeployResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export class CEANAutoDeploy {
  private wrangler: WranglerHelper;
  private config: AutoDeployConfig;

  constructor(config: AutoDeployConfig) {
    this.config = config;
    this.wrangler = new WranglerHelper({
      projectName: config.projectName,
      accountId: '', // Will be inferred or can be added to config
      apiToken: config.apiToken,
      d1DatabaseId: config.databaseId
    });
  }

  /**
   * Run the full deployment pipeline
   */
  async run(): Promise<AutoDeployResult> {
    try {
      logInfo('CEANAutoDeploy', `Starting AutoDeploy for ${this.config.projectName}...`);

      // 1. Validate paths
      if (!existsSync(this.config.schemaPath)) {
        return { success: false, message: `Schema file not found: ${this.config.schemaPath}` };
      }
      if (!existsSync(this.config.workerDir)) {
        return { success: false, message: `Worker directory not found: ${this.config.workerDir}` };
      }

      // 2. Apply D1 Migrations
      logInfo('CEANAutoDeploy', 'Step 1: Applying D1 migrations...');
      const migrationSuccess = await this.wrangler.runD1Migration(
        this.config.databaseId,
        this.config.schemaPath
      );

      if (!migrationSuccess) {
        return { success: false, message: 'D1 migration failed' };
      }

      // 3. Sync Worker (e.g., updating version or specific bindings in wrangler.toml if needed)
      // For now, we ensure wrangler.toml exists and has the right ID
      logInfo('CEANAutoDeploy', 'Step 2: Syncing worker configuration...');
      const wranglerTomlPath = path.join(this.config.workerDir, 'wrangler.toml');
      if (existsSync(wranglerTomlPath)) {
        let tomlContent = readFileSync(wranglerTomlPath, 'utf-8');
        // Simple check/replace for database_id if it's different
        if (tomlContent.includes('database_id =') && !tomlContent.includes(this.config.databaseId)) {
          logInfo('CEANAutoDeploy', 'Updating database_id in wrangler.toml...');
          tomlContent = tomlContent.replace(/database_id = ".*"/, `database_id = "${this.config.databaseId}"`);
          writeFileSync(wranglerTomlPath, tomlContent);
        }
      }

      // 4. Deploy Worker
      logInfo('CEANAutoDeploy', 'Step 3: Deploying worker...');
      // Note: publishWorker uses process.cwd() in wranglerHelper, we need to handle CWD
      const originalCwd = process.cwd();
      try {
        process.chdir(this.config.workerDir);
        const deploySuccess = await this.wrangler.publishWorker();
        if (!deploySuccess) {
          return { success: false, message: 'Worker deployment failed' };
        }
      } finally {
        process.chdir(originalCwd);
      }

      logInfo('CEANAutoDeploy', 'AutoDeploy completed successfully!');
      return { 
        success: true, 
        message: 'Deployment synchronized: D1 schema applied and Worker published.' 
      };

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('CEANAutoDeploy', `AutoDeploy failed: ${error}`);
      return { success: false, message: `AutoDeploy exception: ${error}` };
    }
  }
}
