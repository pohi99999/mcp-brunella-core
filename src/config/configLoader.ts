import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export interface ConfigFile {
  workspaceRoot?: string;
  allowedRoots?: string[];
  denyContains?: string[];
  maxReadBytes?: number;
  maxFileBytesForSearch?: number;
  systemLogDir?: string;
  anythingllmBaseUrl?: string;
  anythingllmWorkspace?: string;
  anythingllmApiKey?: string;
  webUiEnabled?: boolean;
  webUiPort?: number;
  structuredLogging?: boolean;
}

export async function loadConfigFile(filePath?: string): Promise<ConfigFile | null> {
  if (!filePath) {
    // Try default locations
    const defaultPaths = [
      path.join(process.cwd(), 'brunella.config.json'),
      path.join(process.cwd(), 'brunella.config.yaml'),
      path.join(process.cwd(), 'brunella.config.yml'),
      path.join(process.cwd(), 'config.json'),
      path.join(process.cwd(), 'config.yaml'),
    ];

    for (const configPath of defaultPaths) {
      try {
        await fs.access(configPath);
        filePath = configPath;
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!filePath) {
      return null; // No config file found
    }
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content) as ConfigFile;
    } else {
      return JSON.parse(content) as ConfigFile;
    }
  } catch (error) {
    console.error(`Failed to load config file: ${filePath}`, error);
    return null;
  }
}
