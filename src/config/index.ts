// Hybrid config loader - Works in both Node.js and Cloudflare Workers

// Helper to safely get path in Node env
const getPath = async () => {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const pathModule = await import('path');
      return pathModule.default || pathModule;
    } catch {
      return null;
    }
  }
  return null;
};

// Helper to safely join paths
const safeJoin = (base: string, ...parts: string[]) => {
  // Simple fallback for non-Node envs (like Workers)
  // This is a basic implementation, Node's path.join is better handled dynamically if possible
  const separator = '/';
  const replace = new RegExp(separator + '{1,}', 'g');
  return [base, ...parts].join(separator).replace(replace, separator);
};

let workspaceRoot = '';
let systemLogDir = '';

// Initialize default values based on environment
if (typeof process !== 'undefined' && process.cwd) {
  workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
  // We can't synchronously import path here, so we use a safe default relative path
  // or rely on the async initialization in the consumer if needed.
  // For now, we'll use a string concatenation fallback which is usually fine for logs
  systemLogDir = process.env.BRUNELLA_SYSTEM_LOG_DIR || (workspaceRoot + '/logs');
}

export const config = {
  workspaceRoot,
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
  systemLogDir,
  anythingllmBaseUrl: (typeof process !== 'undefined' && process.env?.ANYTHINGLLM_BASE_URL) || 'http://localhost:3001',
  anythingllmWorkspace: (typeof process !== 'undefined' && process.env?.ANYTHINGLLM_WORKSPACE) || '',
  anythingllmApiKey: (typeof process !== 'undefined' && process.env?.ANYTHINGLLM_API_KEY) || ''
};

// Async initializer for Node environment to get proper path handling if needed
export async function initConfig() {
  const path = await getPath();
  if (path) {
    if (!process.env.BRUNELLA_WORKSPACE_ROOT) {
       // Re-evaluate workspace root if needed using path
       config.workspaceRoot = process.cwd();
    }
    if (!process.env.BRUNELLA_SYSTEM_LOG_DIR) {
       config.systemLogDir = path.join(config.workspaceRoot, 'logs');
    }
  }
}
