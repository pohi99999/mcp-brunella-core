import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { config as workspaceConfig } from './index.js';
import { logWarn } from '../utils/logger.js';
import {
  listSafeCommandExamples,
  recommendSafeVerificationCommands,
  type SafeCommandCategory,
} from '../core/safeCommandPolicy.js';

export interface DeveloperProfileServerDescriptor {
  name: string;
  description?: string;
  enabled: boolean;
  source: 'root-config' | 'secondary-config';
}

export interface DeveloperMcpProfile {
  profileId: string;
  workspaceRoot: string;
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryFullName?: string;
  preferredMcpServers: string[];
  availableMcpServers: DeveloperProfileServerDescriptor[];
  safeCommandExamples: string[];
  defaultVerificationCommands: string[];
  commandCategories: Record<SafeCommandCategory, string[]>;
}

interface McpServerConfigRecord {
  name?: string;
  description?: string;
  disabled?: boolean;
}

function normalizeRepositoryName(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase().replace(/\.git$/i, '');
}

function parseRepositoryFromRemote(remote: string): { owner: string; repo: string } | undefined {
  const trimmed = remote.trim();
  const match =
    trimmed.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/i) ??
    trimmed.match(/^([^/]+)\/(.+?)(?:\.git)?$/i);

  if (!match) {
    return undefined;
  }

  return {
    owner: match[1].toLowerCase(),
    repo: match[2].toLowerCase(),
  };
}

function readMcpConfig(filePath: string, source: 'root-config' | 'secondary-config'): DeveloperProfileServerDescriptor[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as McpServerConfigRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => typeof entry.name === 'string' && entry.name.length > 0)
      .map((entry) => ({
        name: String(entry.name),
        description: typeof entry.description === 'string' ? entry.description : undefined,
        enabled: !entry.disabled,
        source,
      }));
  } catch (error) {
    logWarn(
      'DeveloperProfile',
      `Failed to parse MCP config '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

function resolveRepository(): { owner?: string; repo?: string; fullName?: string } {
  const configured = normalizeRepositoryName(process.env.BRUNELLA_REPOSITORY_FULL_NAME);
  if (configured) {
    const [owner, repo] = configured.split('/');
    if (owner && repo) {
      return { owner, repo, fullName: configured };
    }
  }

  try {
    const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    const parsed = parseRepositoryFromRemote(remote);
    if (parsed) {
      return {
        owner: parsed.owner,
        repo: parsed.repo,
        fullName: `${parsed.owner}/${parsed.repo}`,
      };
    }
  } catch {
    logWarn('DeveloperProfile', 'Workspace git remote is not available; repository auto-detection disabled');
  }

  return {};
}

function buildCommandCategories(): Record<SafeCommandCategory, string[]> {
  return {
    inspection: ['git status --short', 'git diff --stat'],
    build: ['npm run build', 'npm run build:ui', 'npx tsc'],
    test: ['npm test', 'npm run test:fast', 'npm run test:dashboard', 'npm run test:ui'],
    lint: ['npm run lint', 'npm run lint:fix'],
  };
}

export function loadDeveloperMcpProfile(): DeveloperMcpProfile {
  const workspaceRoot = path.resolve(workspaceConfig.workspaceRoot);
  const { owner, repo, fullName } = resolveRepository();

  const rootConfigPath = path.resolve(process.cwd(), 'mcp_servers.json');
  const secondaryConfigPath = path.resolve(process.cwd(), 'config', 'mcp_servers.json');
  const availableMcpServers = [
    ...readMcpConfig(rootConfigPath, 'root-config'),
    ...readMcpConfig(secondaryConfigPath, 'secondary-config'),
  ];

  const preferredMcpServers = ['brunella-core', 'brunella-remote', 'filesystem', 'csharp-mcp-server', 'git', 'github', 'desktop-commander', 'chrome-devtools']
    .filter((name, index, values) => values.indexOf(name) === index);

  return {
    profileId: 'developer-mcp-safe-v1',
    workspaceRoot,
    repositoryOwner: owner,
    repositoryName: repo,
    repositoryFullName: fullName,
    preferredMcpServers,
    availableMcpServers,
    safeCommandExamples: listSafeCommandExamples(),
    defaultVerificationCommands: recommendSafeVerificationCommands([
      'src/server/routes/developer.ts',
      'test/routes_developer.test.ts',
    ]),
    commandCategories: buildCommandCategories(),
  };
}
