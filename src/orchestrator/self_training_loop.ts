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
      this.memory = JSON.parse(data);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        // File doesn't exist yet, that's fine
        this.memory = [];
      } else {
        logError('SelfTrainingLoop', `Failed to load memory: ${e.message}`);
      }
    }
  }

  async saveMemory(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.memoryPath), { recursive: true });
      await fs.writeFile(this.memoryPath, JSON.stringify(this.memory, null, 2), 'utf-8');
    } catch (e: any) {
      logError('SelfTrainingLoop', `Failed to save memory: ${e.message}`);
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
    const entry = this.memory.find(m => m.taskId === taskId);
    return entry ? entry.successfulStrategy : null;
  }

  // A mockup of the progressive escalation execution
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
