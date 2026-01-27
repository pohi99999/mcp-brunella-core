import fs from 'fs';
import path from 'path';
import os from 'os';

const GEMINI_DIR = path.join(os.homedir(), '.gemini');
const MEMORY_FILE = path.join(GEMINI_DIR, 'cli_memory.json');

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
        if (!fs.existsSync(GEMINI_DIR)) {
            fs.mkdirSync(GEMINI_DIR, { recursive: true });
        }
    }

    private load(): CliMemory {
        if (fs.existsSync(MEMORY_FILE)) {
            try {
                const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
                return JSON.parse(data);
            } catch (error) {
                console.error('Failed to load memory:', error);
                return {};
            }
        }
        return {};
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
