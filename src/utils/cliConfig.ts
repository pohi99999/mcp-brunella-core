import fs from 'fs';
import path from 'path';
import os from 'os';

/** Flat legacy keys for backward compatibility */
export interface CliSettingsLegacy {
  serverUrl: string;
  apiKey?: string;
  theme?: 'dark' | 'light';
}

/** Gemini-style nested categories (subset for parity) */
export interface BrunellaSettingsSchema {
  general?: {
    preferredEditor?: string;
    vimMode?: boolean;
    previewFeatures?: boolean;
    language?: 'hu' | 'en';
  };
  ui?: {
    theme?: string;
    hideBanner?: boolean;
    hideTips?: boolean;
    hideFooter?: boolean;
  };
  output?: {
    format?: 'text' | 'json';
  };
  model?: {
    name?: string;
    maxSessionTurns?: number;
  };
  modelConfigs?: {
    aliases?: Record<string, { model?: string; extends?: string; modelConfig?: Record<string, unknown> }>;
  };
  context?: {
    fileName?: string | string[];
    includeDirectories?: string[];
    discoveryMaxDirs?: number;
  };
  tools?: {
    approvalMode?: 'default' | 'auto_edit' | 'plan' | 'yolo';
    autoAccept?: boolean;
    allowed?: string[];
    exclude?: string[];
    /** Sandbox: true/false or path to profile (e.g. "docker", ".brunella/sandbox.Dockerfile"). */
    sandbox?: boolean | string;
  };
  mcp?: {
    serverCommand?: string;
    allowed?: string[];
    excluded?: string[];
  };
  telemetry?: {
    enabled?: boolean;
    target?: 'local' | 'gcp';
    otlpEndpoint?: string;
    otlpProtocol?: 'grpc' | 'http';
    outfile?: string;
    logPrompts?: boolean;
    useCollector?: boolean;
    useCliAuth?: boolean;
  };
  privacy?: {
    usageStatisticsEnabled?: boolean;
  };
  skills?: {
    enabled?: boolean;
    disabled?: string[];
  };
  hooksConfig?: {
    enabled?: boolean;
    disabled?: string[];
  };
  admin?: {
    secureModeEnabled?: boolean;
    mcp?: { enabled?: boolean };
    skills?: { enabled?: boolean };
  };
  security?: {
    auth?: {
      selectedType?: 'api_key' | 'oauth' | 'cli';
      enforcedType?: string;
      useExternal?: boolean;
    };
  };
}

/** Combined: legacy flat + nested. Legacy keys take precedence when reading serverUrl/theme for compat. */
export type CliSettings = CliSettingsLegacy & BrunellaSettingsSchema;

const DEFAULT_LEGACY: CliSettingsLegacy = {
  serverUrl: 'http://localhost:3000',
  theme: 'dark'
};

const DEFAULT_NESTED: BrunellaSettingsSchema = {
  general: { vimMode: false, previewFeatures: false, language: 'hu' },
  ui: { theme: 'dark', hideBanner: false, hideTips: false, hideFooter: false },
  output: { format: 'text' },
  model: { maxSessionTurns: -1 },
  context: { fileName: ['BRUNELLA.md', 'GEMINI.md'], discoveryMaxDirs: 200 },
  tools: { approvalMode: 'default', autoAccept: false, allowed: [], exclude: [] },
  telemetry: {
    enabled: false,
    target: 'local',
    otlpEndpoint: 'http://localhost:4317',
    otlpProtocol: 'grpc',
    logPrompts: true,
    useCollector: false
  },
  privacy: { usageStatisticsEnabled: true },
  skills: { enabled: true, disabled: [] },
  hooksConfig: { enabled: true, disabled: [] },
  admin: { secureModeEnabled: false, mcp: { enabled: true }, skills: { enabled: true } }
};

const ENV_MAP: Array<{ env: string; key: string }> = [
  { env: 'BRUNELLA_SERVER_URL', key: 'serverUrl' },
  { env: 'BRUNELLA_API_KEY', key: 'apiKey' },
  { env: 'BRUNELLA_THEME', key: 'theme' },
  { env: 'BRUNELLA_TELEMETRY_ENABLED', key: 'telemetry.enabled' },
  { env: 'BRUNELLA_TELEMETRY_TARGET', key: 'telemetry.target' },
  { env: 'BRUNELLA_TELEMETRY_OTLP_ENDPOINT', key: 'telemetry.otlpEndpoint' },
  { env: 'BRUNELLA_TELEMETRY_OTLP_PROTOCOL', key: 'telemetry.otlpProtocol' },
  { env: 'BRUNELLA_TELEMETRY_OUTFILE', key: 'telemetry.outfile' },
  { env: 'BRUNELLA_TELEMETRY_LOG_PROMPTS', key: 'telemetry.logPrompts' },
  { env: 'BRUNELLA_TELEMETRY_USE_COLLECTOR', key: 'telemetry.useCollector' },
  { env: 'BRUNELLA_TELEMETRY_USE_CLI_AUTH', key: 'telemetry.useCliAuth' },
  { env: 'BRUNELLA_MODEL', key: 'model.name' },
  { env: 'BRUNELLA_OUTPUT_FORMAT', key: 'output.format' },
  { env: 'BRUNELLA_SANDBOX', key: 'tools.sandbox' }
];

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out = { ...target };
  for (const k of Object.keys(source) as (keyof T)[]) {
    const v = source[k];
    if (v === undefined) continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (out as Record<string, unknown>)[k as string] === 'object') {
      (out as Record<string, unknown>)[k as string] = deepMerge(
        (out as Record<string, unknown>)[k as string] as Record<string, unknown>,
        v as Record<string, unknown>
      );
    } else {
      (out as Record<string, unknown>)[k as string] = v;
    }
  }
  return out;
}

function setByPath(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const parts = keyPath.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur) || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function getByPath(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split('.');
  let cur: Record<string, unknown> = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p] as Record<string, unknown>;
  }
  return cur;
}

function parseEnvBool(v: string | undefined): boolean {
  if (v === undefined) return false;
  const lower = String(v).toLowerCase();
  return lower === 'true' || lower === '1';
}

function getSystemDefaultsPath(): string | null {
  const env = process.env.BRUNELLA_CLI_SYSTEM_DEFAULTS_PATH;
  if (env) return env;
  const plat = process.platform;
  if (plat === 'win32') return path.join(process.env.PROGRAMDATA || 'C:/ProgramData', 'brunella-cli', 'system-defaults.json');
  if (plat === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'BrunellaCli', 'system-defaults.json');
  return '/etc/brunella-cli/system-defaults.json';
}

function getSystemSettingsPath(): string | null {
  const env = process.env.BRUNELLA_CLI_SYSTEM_SETTINGS_PATH;
  if (env) return env;
  const plat = process.platform;
  if (plat === 'win32') return path.join(process.env.PROGRAMDATA || 'C:/ProgramData', 'brunella-cli', 'settings.json');
  if (plat === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'BrunellaCli', 'settings.json');
  return '/etc/brunella-cli/settings.json';
}

/** Detect legacy flat format (only serverUrl/apiKey/theme at top level, no nested categories). */
function isLegacyFlat(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
  const legacy = ['serverUrl', 'apiKey', 'theme'];
  if (keys.length === 0) return false;
  const hasNested = keys.some((k) => !legacy.includes(k));
  return !hasNested && keys.some((k) => legacy.includes(k));
}

/** Migrate flat { serverUrl, apiKey, theme } into nested shape and return merged with defaults. */
function migrateLegacyToNested(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...DEFAULT_LEGACY, ...DEFAULT_NESTED } as unknown as Record<string, unknown>;
  if (flat.serverUrl !== undefined) out.serverUrl = flat.serverUrl;
  if (flat.apiKey !== undefined) out.apiKey = flat.apiKey;
  if (flat.theme !== undefined) {
    out.theme = flat.theme;
    if (!out.ui) out.ui = {};
    (out.ui as Record<string, unknown>).theme = flat.theme;
  }
  return out;
}

export class ConfigManager {
  private userConfigPath: string;
  private projectConfigPath: string | null;
  private settings: CliSettings;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.brunella');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.userConfigPath = path.join(configDir, 'settings.json');
    this.projectConfigPath = this.findProjectSettings();
    this.settings = this.loadSettings();
  }

  private findProjectSettings(): string | null {
    let dir = this.cwd;
    const projectFile = path.join(dir, '.brunella', 'settings.json');
    if (fs.existsSync(projectFile)) return projectFile;
    const root = path.parse(dir).root;
    while (dir !== root) {
      dir = path.dirname(dir);
      const p = path.join(dir, '.brunella', 'settings.json');
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private loadJson(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) return {};
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private loadSettings(): CliSettings {
    let base = { ...DEFAULT_LEGACY, ...DEFAULT_NESTED } as CliSettings;

    const sysDefaultsPath = getSystemDefaultsPath();
    if (sysDefaultsPath && fs.existsSync(sysDefaultsPath)) {
      const raw = this.loadJson(sysDefaultsPath);
      base = deepMerge(base as any, raw as any) as CliSettings;
    }

    let userRaw = this.loadJson(this.userConfigPath) as any;
    if (userRaw && Object.keys(userRaw).length > 0 && isLegacyFlat(userRaw)) {
      const migrated = migrateLegacyToNested(userRaw);
      try {
        fs.writeFileSync(this.userConfigPath, JSON.stringify(migrated, null, 2), 'utf-8');
      } catch {
        /* migration write best-effort */
      }
      userRaw = migrated;
    }

    let merged = deepMerge(base as any, userRaw as any) as CliSettings;

    if (this.projectConfigPath) {
      const projRaw = this.loadJson(this.projectConfigPath);
      merged = deepMerge(merged as any, projRaw as any) as CliSettings;
    }

    const sysSettingsPath = getSystemSettingsPath();
    if (sysSettingsPath && fs.existsSync(sysSettingsPath)) {
      const sysRaw = this.loadJson(sysSettingsPath);
      merged = deepMerge(merged as any, sysRaw as any) as CliSettings;
    }

    const mergedObj = merged as unknown as Record<string, unknown>;
    for (const { env, key } of ENV_MAP) {
      const v = process.env[env];
      if (v === undefined) continue;
      if (key === 'telemetry.enabled' || key === 'telemetry.logPrompts' || key === 'telemetry.useCollector' || key === 'telemetry.useCliAuth') {
        setByPath(mergedObj, key, parseEnvBool(v));
      } else {
        setByPath(mergedObj, key, v);
      }
    }

    if (merged.theme === undefined) merged.theme = DEFAULT_LEGACY.theme;
    if (merged.serverUrl === undefined) merged.serverUrl = DEFAULT_LEGACY.serverUrl;
    return merged;
  }

  /** Get by dot path (e.g. "general.vimMode") or legacy key ("serverUrl"). */
  public get<K extends keyof CliSettings>(key: K): CliSettings[K];
  public get(key: string): unknown;
  public get(key: string): unknown {
    if (key in this.settings && !key.includes('.')) {
      return this.settings[key as keyof CliSettings];
    }
    return getByPath(this.settings as unknown as Record<string, unknown>, key);
  }

  public getAll(): CliSettings {
    return JSON.parse(JSON.stringify(this.settings)) as CliSettings;
  }

  /** Set by dot path or legacy key. Persists to user file only; nested keys are merged. */
  public set(key: string, value: unknown): void {
    if (key in this.settings && !key.includes('.') && (key === 'serverUrl' || key === 'apiKey' || key === 'theme')) {
      (this.settings as any)[key] = value;
    } else {
      setByPath(this.settings as unknown as Record<string, unknown>, key, value);
    }
    this.saveUser();
  }

  public setAll(updates: Partial<CliSettings>): void {
    this.settings = deepMerge(this.settings as any, updates as any) as CliSettings;
    this.saveUser();
  }

  private saveUser(): void {
    const dir = path.dirname(this.userConfigPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.userConfigPath, JSON.stringify(this.settings, null, 2), 'utf-8');
  }

  get userSettingsPath(): string {
    return this.userConfigPath;
  }

  get projectSettingsPath(): string | null {
    return this.projectConfigPath;
  }
}

const _instances = new Map<string, ConfigManager>();
let _instance: ConfigManager | null = null;

/** Singleton for default cwd. Use ConfigManager constructor when cwd matters. */
export function getConfigManager(cwd?: string): ConfigManager {
  // Test environment isolation: return fresh instance every time
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  if (isNode && process.env?.NODE_ENV === 'test') {
    _instance = new ConfigManager(cwd);
    return _instance;
  }

  // Fallback if not in Node (e.g. during build-time bundling for Worker)
  if (!isNode) {
    if (!_instance || cwd !== undefined) {
      _instance = new ConfigManager(cwd);
    }
    return _instance;
  }

  // Normal Node.js behavior with caching
  const effectiveCwd = cwd || process.cwd();
  const cacheKey = path.resolve(effectiveCwd);

  let instance = _instances.get(cacheKey);
  if (!instance) {
    instance = new ConfigManager(cwd);
    _instances.set(cacheKey, instance);
  }

  _instance = instance;
  return instance;
}

export const configManager = getConfigManager();
