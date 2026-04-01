import path from 'path';
import { execFileSync } from 'child_process';
import { config } from '../config/index.js';

export type SafeCommandCategory = 'inspection' | 'build' | 'test' | 'lint';

export interface SafeCommandValidation {
  valid: boolean;
  reason?: string;
  executable?: string;
  args: string[];
  normalizedCommand?: string;
  policyId?: string;
  category?: SafeCommandCategory;
  timeoutMs?: number;
}

export interface SafeCommandExecutionResult {
  validation: SafeCommandValidation;
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  normalizedCommand: string;
}

interface SafeNpmScriptPolicy {
  id: string;
  script: string;
  normalizedCommand: string;
  category: SafeCommandCategory;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const BUILD_TIMEOUT_MS = 10 * 60 * 1000;
const TEST_TIMEOUT_MS = 10 * 60 * 1000;

const SAFE_NPM_SCRIPTS: SafeNpmScriptPolicy[] = [
  { id: 'npm-test', script: 'test', normalizedCommand: 'npm test', category: 'test', timeoutMs: TEST_TIMEOUT_MS },
  { id: 'npm-build', script: 'build', normalizedCommand: 'npm run build', category: 'build', timeoutMs: BUILD_TIMEOUT_MS },
  { id: 'npm-build-ui', script: 'build:ui', normalizedCommand: 'npm run build:ui', category: 'build', timeoutMs: BUILD_TIMEOUT_MS },
  { id: 'npm-lint', script: 'lint', normalizedCommand: 'npm run lint', category: 'lint', timeoutMs: DEFAULT_TIMEOUT_MS },
  { id: 'npm-lint-fix', script: 'lint:fix', normalizedCommand: 'npm run lint:fix', category: 'lint', timeoutMs: DEFAULT_TIMEOUT_MS },
  { id: 'npm-test-fast', script: 'test:fast', normalizedCommand: 'npm run test:fast', category: 'test', timeoutMs: TEST_TIMEOUT_MS },
  { id: 'npm-test-dashboard', script: 'test:dashboard', normalizedCommand: 'npm run test:dashboard', category: 'test', timeoutMs: TEST_TIMEOUT_MS },
  { id: 'npm-test-ui', script: 'test:ui', normalizedCommand: 'npm run test:ui', category: 'test', timeoutMs: TEST_TIMEOUT_MS },
  { id: 'npm-smoke', script: 'smoke', normalizedCommand: 'npm run smoke', category: 'inspection', timeoutMs: DEFAULT_TIMEOUT_MS },
];

const SAFE_GIT_COMMANDS = new Map<string, { id: string; category: SafeCommandCategory; timeoutMs: number }>([
  ['status', { id: 'git-status', category: 'inspection', timeoutMs: DEFAULT_TIMEOUT_MS }],
  ['status --short', { id: 'git-status-short', category: 'inspection', timeoutMs: DEFAULT_TIMEOUT_MS }],
  ['diff', { id: 'git-diff', category: 'inspection', timeoutMs: DEFAULT_TIMEOUT_MS }],
  ['diff --stat', { id: 'git-diff-stat', category: 'inspection', timeoutMs: DEFAULT_TIMEOUT_MS }],
  ['rev-parse --abbrev-ref HEAD', { id: 'git-current-branch', category: 'inspection', timeoutMs: DEFAULT_TIMEOUT_MS }],
  ['branch --show-current', { id: 'git-branch-show-current', category: 'inspection', timeoutMs: DEFAULT_TIMEOUT_MS }],
]);

const SHELL_METACHARACTER_PATTERN = /(?:&&|\|\||[|&;<>`])/;
const SUBSHELL_PATTERN = /\$\(/;
const WORKSPACE_ROOT = path.resolve(config.workspaceRoot);

function isWithinWorkspace(resolvedPath: string): boolean {
  return resolvedPath === WORKSPACE_ROOT || resolvedPath.startsWith(`${WORKSPACE_ROOT}${path.sep}`);
}

function normalizePathForMatching(value: string): string {
  return value.replace(/[\\/]+/g, '/');
}

function quoteToken(token: string): string {
  return /\s/.test(token) ? `"${token}"` : token;
}

export function splitCommandLine(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (const char of command.trim()) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error('Unclosed quote in command');
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function hasBlockedShellSyntax(command: string): boolean {
  return SHELL_METACHARACTER_PATTERN.test(command) || SUBSHELL_PATTERN.test(command) || /[\r\n]/.test(command);
}

function isSafeWorkspaceToken(token: string): boolean {
  if (!token || token.startsWith('-')) {
    return false;
  }

  const resolved = path.resolve(WORKSPACE_ROOT, token);
  if (!isWithinWorkspace(resolved)) {
    return false;
  }

  return !config.denyContains.some((fragment) => resolved.includes(fragment));
}

function buildValidDecision(
  executable: string,
  args: string[],
  policyId: string,
  category: SafeCommandCategory,
  timeoutMs: number,
): SafeCommandValidation {
  return {
    valid: true,
    executable,
    args,
    normalizedCommand: [executable, ...args].map(quoteToken).join(' '),
    policyId,
    category,
    timeoutMs,
  };
}

function buildInvalidDecision(reason: string): SafeCommandValidation {
  return {
    valid: false,
    reason,
    args: [],
  };
}

export function executeSafeCommand(command: string, cwd: string = WORKSPACE_ROOT): SafeCommandExecutionResult {
  const validation = validateSafeCommand(command);
  const normalizedCommand = validation.normalizedCommand ?? command.trim();

  if (!validation.valid || !validation.executable) {
    const message = validation.reason ?? 'Command blocked for safety reasons';
    return {
      validation,
      success: false,
      exitCode: null,
      stdout: '',
      stderr: message,
      combinedOutput: message,
      normalizedCommand,
    };
  }

  const resolvedCwd = path.resolve(cwd);
  const safeCwd = isWithinWorkspace(resolvedCwd) ? resolvedCwd : WORKSPACE_ROOT;

  try {
    const stdout = execFileSync(validation.executable, validation.args, {
      cwd: safeCwd,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: validation.timeoutMs,
    });

    return {
      validation,
      success: true,
      exitCode: 0,
      stdout,
      stderr: '',
      combinedOutput: stdout || 'Command succeeded with no output.',
      normalizedCommand,
    };
  } catch (error: unknown) {
    const err = error as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? '';
    const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? '';
    const combinedOutput = `${stdout} ${stderr}`.trim() || err.message || 'Command failed.';

    return {
      validation,
      success: false,
      exitCode: typeof err.status === 'number' ? err.status : null,
      stdout,
      stderr,
      combinedOutput,
      normalizedCommand,
    };
  }
}

function validateNpmCommand(tokens: string[]): SafeCommandValidation {
  if (tokens.length < 2) {
    return buildInvalidDecision('npm command is incomplete');
  }

  if (tokens[1] === 'test') {
    if (tokens.length !== 2) {
      return buildInvalidDecision('npm test does not allow extra arguments in safe mode');
    }

    const policy = SAFE_NPM_SCRIPTS.find((entry) => entry.script === 'test');
    if (!policy) {
      return buildInvalidDecision('npm test is not configured as a safe command');
    }

    return buildValidDecision('npm', ['test'], policy.id, policy.category, policy.timeoutMs);
  }

  if (tokens[1] !== 'run' || tokens.length !== 3) {
    return buildInvalidDecision('Only explicit npm run <script> commands from the allowlist are allowed');
  }

  const script = tokens[2];
  const policy = SAFE_NPM_SCRIPTS.find((entry) => entry.script === script);
  if (!policy) {
    return buildInvalidDecision(`npm script '${script}' is not in the safe allowlist`);
  }

  return buildValidDecision('npm', ['run', script], policy.id, policy.category, policy.timeoutMs);
}

function validateVitestCommand(tokens: string[]): SafeCommandValidation {
  if (tokens.length < 3 || tokens[2] !== 'run') {
    return buildInvalidDecision('Only npx vitest run ... is allowed in safe mode');
  }

  const args = tokens.slice(1);
  for (let index = 3; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--config') {
      const configPath = tokens[index + 1];
      if (!configPath || !isSafeWorkspaceToken(configPath)) {
        return buildInvalidDecision('Vitest config path must stay inside the workspace');
      }
      index += 1;
      continue;
    }

    if (token.startsWith('--')) {
      return buildInvalidDecision(`Vitest flag '${token}' is not allowlisted in safe mode`);
    }

    if (!isSafeWorkspaceToken(token)) {
      return buildInvalidDecision(`Vitest path '${token}' must stay inside the workspace`);
    }
  }

  return buildValidDecision('npx', args, 'npx-vitest-run', 'test', TEST_TIMEOUT_MS);
}

function validateEslintCommand(tokens: string[]): SafeCommandValidation {
  if (tokens.length < 3) {
    return buildInvalidDecision('npx eslint requires at least one workspace path');
  }

  for (const token of tokens.slice(2)) {
    if (token.startsWith('-')) {
      return buildInvalidDecision(`ESLint flag '${token}' is not allowlisted in safe mode`);
    }

    if (!isSafeWorkspaceToken(token)) {
      return buildInvalidDecision(`ESLint path '${token}' must stay inside the workspace`);
    }
  }

  return buildValidDecision('npx', tokens.slice(1), 'npx-eslint', 'lint', DEFAULT_TIMEOUT_MS);
}

function validateTscCommand(tokens: string[]): SafeCommandValidation {
  if (tokens.length !== 2) {
    return buildInvalidDecision('Only bare npx tsc is allowed in safe mode');
  }

  return buildValidDecision('npx', ['tsc'], 'npx-tsc', 'build', BUILD_TIMEOUT_MS);
}

function validateNpxCommand(tokens: string[]): SafeCommandValidation {
  if (tokens.length < 2) {
    return buildInvalidDecision('npx command is incomplete');
  }

  if (tokens[1] === 'vitest') {
    return validateVitestCommand(tokens);
  }

  if (tokens[1] === 'eslint') {
    return validateEslintCommand(tokens);
  }

  if (tokens[1] === 'tsc') {
    return validateTscCommand(tokens);
  }

  return buildInvalidDecision(`npx tool '${tokens[1]}' is not in the safe allowlist`);
}

function validateGitCommand(tokens: string[]): SafeCommandValidation {
  const signature = tokens.slice(1).join(' ');
  const policy = SAFE_GIT_COMMANDS.get(signature);
  if (!policy) {
    if (tokens[1] === 'status' && tokens[2] === '--short') {
      const pathArgs = tokens.slice(3);
      if (pathArgs.some((token) => !isSafeWorkspaceToken(token))) {
        return buildInvalidDecision('git status paths must stay inside the workspace');
      }

      return buildValidDecision('git', tokens.slice(1), 'git-status-short-paths', 'inspection', DEFAULT_TIMEOUT_MS);
    }

    if (tokens[1] === 'diff' && tokens[2] === '--stat' && tokens[3] === '--') {
      const pathArgs = tokens.slice(4);
      if (pathArgs.length === 0) {
        return buildInvalidDecision('git diff --stat -- requires at least one workspace path');
      }
      if (pathArgs.some((token) => !isSafeWorkspaceToken(token))) {
        return buildInvalidDecision('git diff --stat paths must stay inside the workspace');
      }

      return buildValidDecision('git', tokens.slice(1), 'git-diff-stat-paths', 'inspection', DEFAULT_TIMEOUT_MS);
    }

    return buildInvalidDecision(`git command '${signature}' is not in the safe allowlist`);
  }

  return buildValidDecision('git', tokens.slice(1), policy.id, policy.category, policy.timeoutMs);
}

export function validateSafeCommand(command: string): SafeCommandValidation {
  const trimmed = command.trim();
  if (!trimmed) {
    return buildInvalidDecision('Command is empty');
  }

  if (hasBlockedShellSyntax(trimmed)) {
    return buildInvalidDecision('Shell chaining, redirection, and subshell syntax are blocked in safe mode');
  }

  let tokens: string[];
  try {
    tokens = splitCommandLine(trimmed);
  } catch (error) {
    return buildInvalidDecision(error instanceof Error ? error.message : String(error));
  }

  if (tokens.length === 0) {
    return buildInvalidDecision('Command is empty');
  }

  const executable = tokens[0].toLowerCase();
  if (executable === 'npm') {
    return validateNpmCommand(tokens);
  }

  if (executable === 'npx') {
    return validateNpxCommand(tokens);
  }

  if (executable === 'git') {
    return validateGitCommand(tokens);
  }

  return buildInvalidDecision(`Executable '${tokens[0]}' is not in the safe allowlist`);
}

export function listSafeCommandExamples(): string[] {
  return [
    'git status --short',
    'git diff --stat',
    'npm test',
    'npm run build',
    'npm run build:ui',
    'npm run lint',
    'npm run lint:fix',
    'npm run test:fast',
    'npm run test:dashboard',
    'npm run test:ui',
    'npm run smoke',
    'npx tsc',
    'npx eslint src\\server\\routes\\developer.ts test\\routes_developer.test.ts',
    'npx vitest run test\\routes_developer.test.ts',
    'npx vitest run src\\dashboard\\components\\dashboard\\EdgePanel.test.tsx --config vitest.dashboard.config.ts',
  ];
}

export function recommendSafeVerificationCommands(filePaths: string[]): string[] {
  const recommendations = new Set<string>(['git status --short', 'git diff --stat']);
  const normalizedPaths = filePaths.map((entry) => normalizePathForMatching(path.normalize(entry)));
  const hasDashboardPath = normalizedPaths.some((entry) => entry.startsWith('src/dashboard'));
  const hasCodePath = normalizedPaths.some((entry) => entry.startsWith('src/') || entry.startsWith('test/'));
  const targetedTest = normalizedPaths.find((entry) => /\.test\.(ts|tsx|js|jsx)$/i.test(entry));

  if (hasCodePath) {
    recommendations.add('npm run build');
    recommendations.add('npm run test:fast');
  }

  if (hasDashboardPath) {
    recommendations.add('npm run build:ui');
    recommendations.add('npm run test:dashboard');
  }

  if (targetedTest) {
    recommendations.add(`npx vitest run ${quoteToken(targetedTest)}`);
  }

  return Array.from(recommendations).filter((entry) => validateSafeCommand(entry).valid);
}
