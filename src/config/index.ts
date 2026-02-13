import path from 'path';

const defaultWorkspace = process.cwd();
const defaultLogDir = path.join(process.cwd(), 'logs');

export const config = {
  workspaceRoot: process.env.BRUNELLA_WORKSPACE_ROOT || defaultWorkspace,
  allowedRoots: [
    // Legacy numbered folders
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
    '99_SYSTEM_LOGS',
    // Active project directories
    'src',
    'myai',
    'conductor',
    'test',
    'docs',
    'scripts',
    'data',
    'public',
    'schemas',
    'ADR',
    '_KNOWLEDGE_BASE',
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
  systemLogDir: process.env.BRUNELLA_SYSTEM_LOG_DIR || defaultLogDir,
  anythingllmBaseUrl: process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001',
  anythingllmWorkspace: process.env.ANYTHINGLLM_WORKSPACE || '',
  anythingllmApiKey: process.env.ANYTHINGLLM_API_KEY || ''
};
