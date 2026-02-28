import fs from 'fs/promises';
import path from 'path';
import { logInfo, logError, logWarn } from '../utils/logger.js';

interface MemoryEntry {
  taskId: string;
  successfulStrategy: string;
  timestamp: string;
}

export class SelfTrainingLoop {
  private memoryPath: string;
  private memory: MemoryEntry[] = [];

  constructor() {
    this.memoryPath = path.join(process.cwd(), 'data', 'robotkez_memory.json');
  }

  async loadMemory(): Promise<void> {
    try {
      const data = await fs.readFile(this.memoryPath, 'utf-8');
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Régi TS formátum: MemoryEntry[]
        this.memory = parsed as MemoryEntry[];
      } else if (parsed && typeof parsed === 'object') {
        // Új Python-kompatibilis formátum: { solutions: {taskKey: [{action, success, ...}]} }
        this.memory = [];
        const obj = parsed as Record<string, unknown>;
        const solutions = obj['solutions'];
        if (solutions && typeof solutions === 'object' && !Array.isArray(solutions)) {
          for (const [taskId, entries] of Object.entries(solutions as Record<string, unknown>)) {
            if (!Array.isArray(entries)) continue;
            const successful = (entries as Record<string, unknown>[]).find(e => e['success'] === true);
            if (successful) {
              this.memory.push({
                taskId,
                successfulStrategy: String(successful['action'] ?? 'click'),
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        // Saját TS bejegyzések megőrzése (ha vannak)
        const tsEntries = obj['_ts_entries'];
        if (Array.isArray(tsEntries)) {
          this.memory.push(...(tsEntries as MemoryEntry[]));
        }
      } else {
        this.memory = [];
      }
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // Még nem létezik a fájl
        this.memory = [];
      } else {
        logError('SelfTrainingLoop', `Failed to load memory: ${err.message}`);
        this.memory = [];
      }
    }
  }

  async saveMemory(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.memoryPath), { recursive: true });
      // Meglévő fájl formátumának megőrzése (Python-kompatibilis objektum)
      let existing: Record<string, unknown> | null = null;
      try {
        const raw = await fs.readFile(this.memoryPath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          existing = parsed as Record<string, unknown>;
        }
      } catch {
        // Nem létezik vagy sérült — új fájlt írunk
      }

      if (existing) {
        // Objektum formátumba menti az TS bejegyzéseket külön kulcs alá
        existing['_ts_entries'] = this.memory;
        await fs.writeFile(this.memoryPath, JSON.stringify(existing, null, 2), 'utf-8');
      } else {
        await fs.writeFile(this.memoryPath, JSON.stringify(this.memory, null, 2), 'utf-8');
      }
    } catch (e: unknown) {
      logError('SelfTrainingLoop', `Failed to save memory: ${(e as Error).message}`);
    }
  }

  async addMemory(taskId: string, strategy: string): Promise<void> {
    this.memory.push({
      taskId,
      successfulStrategy: strategy,
      timestamp: new Date().toISOString()
    });
    await this.saveMemory();
  }

  getMemoryForTask(taskId: string): string | null {
    const entry = this.memory.find((m: MemoryEntry) => m.taskId === taskId);
    return entry ? entry.successfulStrategy : null;
  }

  // Progresszív eszkaláció: DOM → Kinetic → Computer Use → Vision API
  async executeWithRetry(
    taskId: string,
    taskDescription: string,
    actionFn: (strategy: string) => Promise<boolean>,
    maxDurationHours: number = 4
  ): Promise<boolean> {
    logInfo('SelfTrainingLoop', `Starting task: "${taskDescription}"`);
    
    await this.loadMemory();
    const knownStrategy = this.getMemoryForTask(taskId);
    
    if (knownStrategy) {
      logInfo('SelfTrainingLoop', `Found known strategy in memory: ${knownStrategy}`);
      const success = await actionFn(knownStrategy);
      if (success) {
        logInfo('SelfTrainingLoop', `Task completed using known strategy.`);
        return true;
      }
      logWarn('SelfTrainingLoop', `Known strategy failed, falling back to escalation.`);
    }

    const strategies = [
      'DOM Check (Close Modals)',
      'Kinetic (Scroll and Retry)',
      'Native Computer Use (Coordinate Click)',
      'Vision API Analysis'
    ];

    for (let i = 0; i < strategies.length; i++) {
      const currentStrategy = strategies[i];
      logInfo('SelfTrainingLoop', `[Próbálkozás ${i + 1}/${strategies.length}] Stratégia: ${currentStrategy}`);
      
      const success = await actionFn(currentStrategy);
      
      if (success) {
        logInfo('SelfTrainingLoop', `✅ Siker! Ezzel a stratégiával: ${currentStrategy}`);
        await this.addMemory(taskId, currentStrategy);
        return true;
      } else {
        logWarn('SelfTrainingLoop', `❌ Hiba a ${currentStrategy} stratégiával. Eszkaláció...`);
      }
    }

    logError('SelfTrainingLoop', `💥 A feladat az összes stratégia után is sikertelen.`);
    return false;
  }
}

export const selfTrainingLoop = new SelfTrainingLoop();
