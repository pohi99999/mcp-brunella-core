import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CliSettings {
  serverUrl: string;
  apiKey?: string;
  theme?: 'dark' | 'light';
}

const DEFAULT_SETTINGS: CliSettings = {
  serverUrl: 'http://localhost:3000',
  theme: 'dark'
};

export class ConfigManager {
  private configPath: string;
  private settings: CliSettings;

  constructor() {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.brunella');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.configPath = path.join(configDir, 'settings.json');
    this.settings = this.loadSettings();
  }

  private loadSettings(): CliSettings {
    if (fs.existsSync(this.configPath)) {
      try {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      } catch (error) {
        console.error('Failed to parse settings file, using defaults.');
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  }

  public get<K extends keyof CliSettings>(key: K): CliSettings[K] {
    return this.settings[key];
  }

  public getAll(): CliSettings {
    return { ...this.settings };
  }

  public set<K extends keyof CliSettings>(key: K, value: CliSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  private save(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
  }
}

export const configManager = new ConfigManager();
