/**
 * Memory Tool — MCP tool felhasználói preferenciák és kontextuális memória kezelésére
 */
import { logInfo, logError } from "../utils/logger.js";
import {
  savePreference,
  queryPreferences,
  deletePreference,
  getPreferenceContext,
  getPreferenceStats,
  purgeExpiredPreferences,
} from "../core/userPreferences.js";

export async function memoryStoreHandler(params: {
  user_id: string;
  key: string;
  value: string;
  memory_type?: string;
  ttl_days?: number;
}) {
  logInfo("memoryTool", `Storing preference: ${params.key} for user ${params.user_id}`);
  try {
    const memoryType = (params.memory_type ?? "semantic") as "episodic" | "semantic" | "procedural";
    const expiresAt = params.ttl_days
      ? new Date(Date.now() + params.ttl_days * 86400000).toISOString()
      : undefined;
    savePreference({
      user_id: params.user_id,
      key: params.key,
      value: params.value,
      memory_type: memoryType,
      category: "general",
      confidence: 0.8,
      source_agent: "mcp",
      metadata_json: "{}",
      expires_at: expiresAt ?? null,
    });
    return { success: true, message: `Preference '${params.key}' saved for user ${params.user_id}` };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("memoryTool", error);
    return { success: false, error };
  }
}

export async function memoryQueryHandler(params: {
  user_id: string;
  memory_type?: string;
  key_pattern?: string;
  limit?: number;
}) {
  logInfo("memoryTool", `Querying preferences for user ${params.user_id}`);
  try {
    const prefs = queryPreferences({
      user_id: params.user_id,
      memory_type: params.memory_type as "episodic" | "semantic" | "procedural" | undefined,
      key: params.key_pattern,
      limit: params.limit ?? 50,
    });
    return { success: true, count: prefs.length, preferences: prefs };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("memoryTool", error);
    return { success: false, error };
  }
}

export async function memoryContextHandler(params: { user_id: string }) {
  logInfo("memoryTool", `Getting preference context for user ${params.user_id}`);
  try {
    const context = getPreferenceContext(params.user_id);
    const stats = getPreferenceStats(params.user_id);
    return { success: true, context, stats };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("memoryTool", error);
    return { success: false, error };
  }
}

export async function memoryDeleteHandler(params: {
  user_id: string;
  key: string;
  memory_type?: string;
}) {
  logInfo("memoryTool", `Deleting preference: ${params.key} for user ${params.user_id}`);
  try {
    const deleted = deletePreference(
      params.user_id,
      params.key,
      params.memory_type as "episodic" | "semantic" | "procedural" | undefined,
    );
    return { success: true, deleted };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("memoryTool", error);
    return { success: false, error };
  }
}

export async function memoryPurgeHandler(_params: Record<string, never>) {
  logInfo("memoryTool", "Purging expired preferences");
  try {
    const count = purgeExpiredPreferences();
    return { success: true, purged: count };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("memoryTool", error);
    return { success: false, error };
  }
}
