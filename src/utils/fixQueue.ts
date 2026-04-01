import fs from "fs";
import path from "path";
import { logInfo, logError } from "./logger.js";

const FIX_QUEUE_FILE = path.join(process.cwd(), "data", "fix_queue.json");

export interface FixItem {
  id: string;
  source: string; // Who reported it (e.g., 'User', 'HealthCheck')
  description: string; // What is broken
  priority: "critical" | "high" | "normal";
  status: "pending" | "in-progress" | "resolved" | "failed";
  createdAt: string;
  attempts: number;
  lastError?: string;
}

/**
 * Ensures the fix queue file exists.
 */
function ensureQueueFile() {
  const dir = path.dirname(FIX_QUEUE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(FIX_QUEUE_FILE)) {
    fs.writeFileSync(FIX_QUEUE_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

/**
 * Adds a new item to the Fix Queue.
 */
export function addToFixQueue(
  description: string,
  source: string = "System",
  priority: FixItem["priority"] = "normal",
): string {
  ensureQueueFile();
  try {
    const queue: FixItem[] = JSON.parse(
      fs.readFileSync(FIX_QUEUE_FILE, "utf-8"),
    );
    const id = `fix-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Avoid duplicates (simple check based on description)
    if (
      queue.some(
        (i) => i.description === description && i.status !== "resolved",
      )
    ) {
      return "duplicate";
    }

    const newItem: FixItem = {
      id,
      source,
      description,
      priority,
      status: "pending",
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    queue.push(newItem);
    fs.writeFileSync(FIX_QUEUE_FILE, JSON.stringify(queue, null, 2), "utf-8");
    logInfo("FixQueue", `New issue added: ${description} [${id}]`);
    return id;
  } catch (e) {
    logError("FixQueue", `Failed to add item: ${(e as Error).message}`);
    return "error";
  }
}

/**
 * Gets all pending items sorted by priority.
 */
export function getPendingFixes(): FixItem[] {
  ensureQueueFile();
  try {
    const queue: FixItem[] = JSON.parse(
      fs.readFileSync(FIX_QUEUE_FILE, "utf-8"),
    );
    return queue
      .filter((i) => i.status === "pending" || i.status === "in-progress")
      .sort((a, b) => {
        const pMap = { critical: 3, high: 2, normal: 1 };
        return pMap[b.priority] - pMap[a.priority];
      });
  } catch (e) {
    return [];
  }
}

/**
 * Updates the status of a fix item.
 */
export function updateFixStatus(
  id: string,
  status: FixItem["status"],
  lastError?: string,
) {
  ensureQueueFile();
  try {
    const queue: FixItem[] = JSON.parse(
      fs.readFileSync(FIX_QUEUE_FILE, "utf-8"),
    );
    const idx = queue.findIndex((i) => i.id === id);
    if (idx !== -1) {
      queue[idx].status = status;
      if (lastError) queue[idx].lastError = lastError;
      if (status === "in-progress" || status === "failed")
        queue[idx].attempts++;

      fs.writeFileSync(FIX_QUEUE_FILE, JSON.stringify(queue, null, 2), "utf-8");
    }
  } catch (e) {
    logError("FixQueue", `Update failed: ${(e as Error).message}`);
  }
}
