// Zone IV: Phoenix Protocol – Checkpointing for state restoration
import fs from "fs/promises";
import path from "path";

const CHECKPOINT_PATH = "./logs/health_status.json";

export interface HealthCheckpoint {
  timestamp: string;
  lastTask?: { agent: string; description: string; status: string };
  agents?: Record<string, { status: string; lastTask?: string }>;
}

export async function saveCheckpoint(data: Partial<HealthCheckpoint>): Promise<void> {
  const full: HealthCheckpoint = {
    timestamp: new Date().toISOString(),
    ...data,
  };
  await fs.mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true }).catch(() => {});
  await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(full, null, 2), "utf-8");
}

export async function loadCheckpoint(): Promise<HealthCheckpoint | null> {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, "utf-8");
    return JSON.parse(raw) as HealthCheckpoint;
  } catch {
    return null;
  }
}
