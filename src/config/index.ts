import path from 'path';
import { loadConfigFile, ConfigFile } from './configLoader.js';

// Default configuration
const defaultConfig = {
  workspaceRoot: 'F:\\OneDrive\\Desktop\\Brunella_es_en',
  allowedRoots: [
    '00_BAS_SYSTEM',
    '00_INBOX',
    '01_CONTEXT',
    '02_PROJECTS',
    '03_LIBRARY',
    '04_ARCHIVE',
    '05_CONFIG',
    '06_CORE',
    '07_KNOWLEDGE_BASE',
    '08_SCRIPTS',
    '99_SYSTEM_LOGS'
  ],
  denyContains: [
    '09_SECRETS',
    '.env',
    '.pem',
    '.p12',
    'client_secret',
    'credentials',
    'token',
    'id_rsa',
    'id_ed25519'
  ],
  maxReadBytes: 400000, // 400KB
  maxFileBytesForSearch: 2000000, // 2MB
  systemLogDir: path.join(process.cwd(), 'logs'),
  anythingllmBaseUrl: 'http://localhost:3001',
  anythingllmWorkspace: '',
  anythingllmApiKey: '',
  webUiEnabled: true,
  webUiPort: 3000,
  structuredLogging: true
};

// Load config from file if available
let fileConfig: ConfigFile | null = null;

// Async initialization function
async function initializeConfig() {
  fileConfig = await loadConfigFile(process.env.CONFIG_FILE);
}

// Initialize synchronously if possible, but don't block
initializeConfig().catch(err => {
  console.error('Failed to load config file, using defaults:', err);
});

// Merge function: env vars > config file > defaults
function mergeConfig(): typeof defaultConfig {
  const merged = { ...defaultConfig };
  
  // Apply file config
  if (fileConfig) {
    if (fileConfig.workspaceRoot) merged.workspaceRoot = fileConfig.workspaceRoot;
    if (fileConfig.allowedRoots) merged.allowedRoots = fileConfig.allowedRoots;
    if (fileConfig.denyContains) merged.denyContains = fileConfig.denyContains;
    if (fileConfig.maxReadBytes !== undefined) merged.maxReadBytes = fileConfig.maxReadBytes;
    if (fileConfig.maxFileBytesForSearch !== undefined) merged.maxFileBytesForSearch = fileConfig.maxFileBytesForSearch;
    if (fileConfig.systemLogDir) merged.systemLogDir = fileConfig.systemLogDir;
    if (fileConfig.anythingllmBaseUrl) merged.anythingllmBaseUrl = fileConfig.anythingllmBaseUrl;
    if (fileConfig.anythingllmWorkspace !== undefined) merged.anythingllmWorkspace = fileConfig.anythingllmWorkspace;
    if (fileConfig.anythingllmApiKey) merged.anythingllmApiKey = fileConfig.anythingllmApiKey;
    if (fileConfig.webUiEnabled !== undefined) merged.webUiEnabled = fileConfig.webUiEnabled;
    if (fileConfig.webUiPort !== undefined) merged.webUiPort = fileConfig.webUiPort;
    if (fileConfig.structuredLogging !== undefined) merged.structuredLogging = fileConfig.structuredLogging;
  }

  // Environment variables override everything
  if (process.env.WORKSPACE_ROOT) merged.workspaceRoot = process.env.WORKSPACE_ROOT;
  if (process.env.ANYTHINGLLM_BASE_URL) merged.anythingllmBaseUrl = process.env.ANYTHINGLLM_BASE_URL;
  if (process.env.ANYTHINGLLM_WORKSPACE) merged.anythingllmWorkspace = process.env.ANYTHINGLLM_WORKSPACE;
  if (process.env.ANYTHINGLLM_API_KEY) merged.anythingllmApiKey = process.env.ANYTHINGLLM_API_KEY;
  if (process.env.WEB_UI_ENABLED !== undefined) {
    merged.webUiEnabled = process.env.WEB_UI_ENABLED !== '0' && process.env.WEB_UI_ENABLED !== 'false';
  }
  if (process.env.WEB_UI_PORT) {
    const port = parseInt(process.env.WEB_UI_PORT, 10);
    if (!isNaN(port)) merged.webUiPort = port;
  }
  if (process.env.STRUCTURED_LOGGING !== undefined) {
    merged.structuredLogging = process.env.STRUCTURED_LOGGING !== '0';
  }

  return merged;
}

// Export config (will use defaults initially, then merge with file config when loaded)
export const config = mergeConfig();

// Export function to reload config (useful for testing or runtime updates)
export async function reloadConfig(): Promise<void> {
  await initializeConfig();
  Object.assign(config, mergeConfig());
}
