/**
 * Workspace CLI Commands - Google Workspace Integration
 * 
 * Commands for authenticating and managing Google Workspace API access.
 * 
 * @module cli/workspaceCommands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { google } from 'googleapis';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import open from 'open';
import { logInfo, logError } from '../utils/logger.js';
import {
  createGoogleWorkspaceOAuthClient,
  ensureGoogleWorkspaceAuthDirectories,
  getGoogleAuth,
  getGoogleWorkspaceAuthPaths,
} from '../utils/googleAuth.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
];

/**
 * Register workspace commands
 */
export function registerWorkspaceCommands(program: Command): void {
  const workspace = program
    .command('workspace')
    .description('Manage Google Workspace integration');

  // brunella workspace auth
  workspace
    .command('auth')
    .description('Authenticate with Google Workspace APIs')
    .action(async () => {
      console.log(chalk.bold('\n🔐 Google Workspace Authentication\n'));
      const authPaths = getGoogleWorkspaceAuthPaths();

      // Check if credentials file exists
      if (!existsSync(authPaths.credentialsPath)) {
        console.log(chalk.red('❌ Google credentials not found!'));
        console.log(
          chalk.yellow(
            `\nPlease download your OAuth 2.0 credentials from Google Cloud Console:`
          )
        );
        console.log(chalk.cyan('   1. Go to https://console.cloud.google.com/apis/credentials'));
        console.log(chalk.cyan('   2. Create OAuth 2.0 Client ID (Desktop app)'));
        console.log(
          chalk.cyan(
            `   3. Download JSON and save as:\n      ${authPaths.preferredCredentialsPath}\n`,
          ),
        );
        console.log(
          chalk.dim(
            'Optional override: set GOOGLE_WORKSPACE_CREDENTIALS_FILE to a different gitignored path.',
          ),
        );
        console.log(
          chalk.dim('See docs/GOOGLE_WORKSPACE_SETUP.md for detailed instructions.')
        );
        return;
      }

      try {
        await ensureGoogleWorkspaceAuthDirectories(authPaths);
        const { oAuth2Client, paths } = await createGoogleWorkspaceOAuthClient();

        // Generate auth URL
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPES,
        });

        console.log(chalk.bold('📋 Authorization Steps:\n'));
        console.log(chalk.cyan('1. Opening browser for Google authorization...'));
        console.log(chalk.dim(`   ${authUrl}\n`));

        // Open browser
        await open(authUrl);

        // Prompt for authorization code
        const { code } = await inquirer.prompt([
          {
            type: 'input',
            name: 'code',
            message: 'Paste the authorization code from the browser:',
            validate: (input) => input.length > 0 || 'Code cannot be empty',
          },
        ]);

        const spinner = ora('Exchanging code for tokens...').start();

        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save tokens
        await fs.writeFile(paths.preferredTokenPath, JSON.stringify(tokens, null, 2));

        spinner.succeed('Tokens saved successfully!');

        console.log(chalk.green('\n✅ Google Workspace authentication complete!\n'));
        console.log(chalk.dim(`Token saved to: ${paths.preferredTokenPath}`));
        console.log(chalk.dim('This token will be used for all Google API operations.\n'));
        if (paths.usingLegacyCredentialsPath) {
          console.log(
            chalk.yellow(
              `⚠ Legacy credentials path still in use: ${paths.credentialsPath}\n   Preferred path: ${paths.preferredCredentialsPath}\n`,
            ),
          );
        }

        logInfo('WorkspaceCLI', 'Google Workspace authentication successful');
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`\n❌ Authentication failed: ${errorMsg}\n`));
        logError('WorkspaceCLI', `Auth failed: ${errorMsg}`);
      }
    });

  // brunella workspace status
  workspace
    .command('status')
    .description('Check Google Workspace authentication status')
    .action(async () => {
      console.log(chalk.bold('\n📊 Google Workspace Status\n'));
      const authPaths = getGoogleWorkspaceAuthPaths();

      const hasCredentials = existsSync(authPaths.credentialsPath);
      const hasToken = existsSync(authPaths.tokenPath);

      console.log(`Credentials: ${hasCredentials ? chalk.green('✔ Found') : chalk.red('✘ Missing')}`);
      console.log(`Token:       ${hasToken ? chalk.green('✔ Found') : chalk.red('✘ Missing')}`);

      if (hasCredentials) {
        console.log(chalk.dim(`  ${authPaths.credentialsPath}`));
      }
      if (hasToken) {
        console.log(chalk.dim(`  ${authPaths.tokenPath}`));

        try {
          const tokenContent = await fs.readFile(authPaths.tokenPath, 'utf-8');
          const token = JSON.parse(tokenContent);

          if (token.expiry_date) {
            const expiryDate = new Date(token.expiry_date);
            const now = new Date();
            const isExpired = expiryDate < now;

            console.log(
              `\nToken Status: ${isExpired ? chalk.red('⚠ Expired') : chalk.green('✔ Valid')}`
            );
            console.log(
              chalk.dim(`  Expires: ${expiryDate.toLocaleString()}`)
            );

            if (isExpired) {
              console.log(
                chalk.yellow('\n⚠ Token expired. Run `brunella workspace auth` to re-authenticate.\n')
              );
            }
          }
        } catch (error: unknown) {
          console.log(chalk.yellow('\n⚠ Could not read token file.\n'));
        }
      }

      if (authPaths.usingLegacyCredentialsPath) {
        console.log(
          chalk.yellow(
            `\n⚠ Legacy credentials path detected. Preferred path: ${authPaths.preferredCredentialsPath}`
          ),
        );
      }
      if (authPaths.usingLegacyTokenPath) {
        console.log(
          chalk.yellow(
            `⚠ Legacy token path detected. Preferred path: ${authPaths.preferredTokenPath}\n`
          ),
        );
      }

      if (!hasCredentials || !hasToken) {
        console.log(
          chalk.yellow(
            '\n⚠ Not authenticated. Run `brunella workspace auth` to get started.\n'
          )
        );
      } else if (hasToken) {
        console.log(chalk.green('\n✅ Ready to use Google Workspace APIs!\n'));
      }
    });

  // brunella workspace test
  workspace
    .command('test')
    .description('Test Google Workspace API connectivity')
    .action(async () => {
      console.log(chalk.bold('\n🧪 Testing Google Workspace APIs\n'));
      const authPaths = getGoogleWorkspaceAuthPaths();

      if (!existsSync(authPaths.tokenPath)) {
        console.log(chalk.red('❌ Not authenticated. Run `brunella workspace auth` first.\n'));
        return;
      }

      try {
        const oAuth2Client = await getGoogleAuth();

        console.log(chalk.cyan('Testing Gmail API...'));
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log(chalk.green(`✔ Gmail: ${profile.data.emailAddress}`));

        console.log(chalk.cyan('Testing Drive API...'));
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });
        const files = await drive.files.list({ pageSize: 1 });
        console.log(chalk.green(`✔ Drive: Access OK (${files.data.files?.length || 0} files)`));

        console.log(chalk.cyan('Testing Calendar API...'));
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const calendars = await calendar.calendarList.list();
        console.log(
          chalk.green(`✔ Calendar: Access OK (${calendars.data.items?.length || 0} calendars)`)
        );

        console.log(chalk.green('\n✅ All Google Workspace APIs are working!\n'));
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`\n❌ Test failed: ${errorMsg}\n`));
        console.log(
          chalk.yellow('Try running `brunella workspace auth` to re-authenticate.\n')
        );
      }
    });
}
