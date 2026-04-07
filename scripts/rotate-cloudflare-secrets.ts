import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import chalk from 'chalk';

/**
 * Cloudflare Secret Rotation Script
 * 
 * This script:
 * 1. Generates a new secure random key for BAS_API_KEY
 * 2. Backs up the current .env file
 * 3. Updates the .env file with the new key (CEAN_API_KEY)
 * 4. Pushes the new secret to Cloudflare Workers using Wrangler
 */

async function rotateSecrets() {
  console.log(chalk.cyan('\n🔐 Starting Cloudflare Secret Rotation...'));

  // 1. Load current environment
  dotenv.config();
  const envPath = path.resolve(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error(chalk.red('❌ .env file not found.'));
    process.exit(1);
  }

  // 2. Generate new key (64 chars hex)
  const newKey = crypto.randomBytes(32).toString('hex');
  console.log(chalk.green('✅ Generated new secure key.'));

  // 3. Backup .env
  const backupPath = `${envPath}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(envPath, backupPath);
  console.log(chalk.gray(`📦 Backup created: ${path.basename(backupPath)}`));

  // 4. Update .env content
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update CEAN_API_KEY
  if (envContent.includes('CEAN_API_KEY=')) {
    envContent = envContent.replace(/^CEAN_API_KEY=.*$/m, `CEAN_API_KEY=${newKey}`);
  } else {
    envContent += `\nCEAN_API_KEY=${newKey}\n`;
  }

  // Update BAS_API_KEY if present (sometimes used interchangeably)
  if (envContent.includes('BAS_API_KEY=')) {
    envContent = envContent.replace(/^BAS_API_KEY=.*$/m, `BAS_API_KEY=${newKey}`);
  }

  fs.writeFileSync(envPath, envContent);
  console.log(chalk.green('✅ Updated .env file locally.'));

  // 5. Push to Cloudflare Workers
  const workers = ['cean-orchestrator', 'bas-orchestrator'];
  const workerDirs = ['cloudflare', 'bas-cloudflare-orchestrator'];

  console.log(chalk.yellow('\n🚀 Pushing secrets to Cloudflare...'));

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    const dir = workerDirs[i];
    const fullDir = path.resolve(process.cwd(), dir);

    if (fs.existsSync(fullDir)) {
      try {
        console.log(chalk.blue(`   Updating secret for ${worker}...`));
        
        // Create a clean env for wrangler to avoid "logged in with an API Token" error
        const cleanEnv = { ...process.env };
        delete cleanEnv.CLOUDFLARE_API_TOKEN;
        delete cleanEnv.CF_API_TOKEN;
        delete cleanEnv.CF_TOKEN;

        // Use wrangler secret put
        // Note: echo | wrangler secret put allows non-interactive update
        execSync(`echo ${newKey} | npx wrangler secret put BAS_API_KEY`, { 
          cwd: fullDir,
          stdio: 'inherit',
          env: cleanEnv
        });
        console.log(chalk.green(`   ✨ ${worker} updated successfully.`));
      } catch (err: any) {
        console.warn(chalk.red(`   ⚠️ Failed to update ${worker}: ${err.message}`));
        console.log(chalk.gray(`   Make sure you are logged in: npx wrangler login`));
      }
    }
  }

  console.log(chalk.cyan('\n✨ Secret rotation complete!'));
  console.log(chalk.white('Next steps:'));
  console.log(chalk.gray('1. Verify local connection with "npm run smoke"'));
  console.log(chalk.gray('2. If everything is OK, you can delete the backup file.'));
}

rotateSecrets().catch(err => {
  console.error(chalk.red('\n💥 Critical error during rotation:'), err);
  process.exit(1);
});
