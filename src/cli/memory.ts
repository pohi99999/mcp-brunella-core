import fs from 'fs';
import path from 'path';
import os from 'os';

const MEMORY_FILENAME = 'cli_memory.json';
const LEGACY_GEMINI_DIR = path.join(os.homedir(), '.gemini');
const LEGACY_MEMORY_FILE = path.join(LEGACY_GEMINI_DIR, MEMORY_FILENAME);
// New, Brunella-native location. Can be overridden with BRUNELLA_HOME.
const BRUNELLA_HOME = process.env.BRUNELLA_HOME || path.join(os.homedir(), '.brunella');
const MEMORY_FILE = path.join(BRUNELLA_HOME, MEMORY_FILENAME);

export interface CliMemory {
    lastRun?: string;
    mode?: 'safe' | 'full';
    plugins?: string[];
    history?: string[];
    model?: string;
    llm_base_url?: string;
}

export class MemoryManager {
    private memory: CliMemory;

    constructor() {
        this.ensureDirectory();
        this.memory = this.load();
    }

    private ensureDirectory() {
        if (!fs.existsSync(BRUNELLA_HOME)) {
            fs.mkdirSync(BRUNELLA_HOME, { recursive: true });
        }
    }

    private load(): CliMemory {
        // Preferred: Brunella-native memory file
        if (fs.existsSync(MEMORY_FILE)) {
            return this.safeRead(MEMORY_FILE);
        }

        // Legacy compatibility: load once from .gemini if present, then save to new location
        if (fs.existsSync(LEGACY_MEMORY_FILE)) {
            const legacy = this.safeRead(LEGACY_MEMORY_FILE);
            this.memory = legacy;
            this.save();
            return legacy;
        }

        return {};
    }

    private safeRead(filePath: string): CliMemory {
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Failed to load memory from ${filePath}:`, error);
            return {};
        }
    }

    public save() {
        try {
            fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memory, null, 2));
        } catch (error) {
            console.error('Failed to save memory:', error);
        }
    }

    public get<K extends keyof CliMemory>(key: K): CliMemory[K] {
        return this.memory[key];
    }

    public set<K extends keyof CliMemory>(key: K, value: CliMemory[K]) {
        this.memory[key] = value;
        this.save();
    }
}
