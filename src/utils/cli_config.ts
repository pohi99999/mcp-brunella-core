import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.brunella');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

export interface CliConfig {
    serverUrl: string;
    apiKey: string;
    defaultAgent?: string;
    [key: string]: any;
}

export function loadConfig(): CliConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        // ignore
    }
    return {
        serverUrl: 'http://localhost:3000',
        apiKey: 'default-key'
    };
}

export function saveConfig(config: CliConfig) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
