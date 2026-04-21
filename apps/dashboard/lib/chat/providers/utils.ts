import type { ChatSendOutput } from "../types";

type MaybeChatPayload = {
  message?: unknown;
  data?: unknown;
  thoughts?: unknown;
  contextUsed?: unknown;
  executedBy?: unknown;
};

function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function toChatOutput(
  payload: unknown,
  fallbackExecutedBy?: string,
): ChatSendOutput {
  if (!payload || typeof payload !== "object") {
    return {
      message: safeString(payload),
      executedBy: fallbackExecutedBy,
    };
  }

  const value = payload as MaybeChatPayload;
  const contextUsed = Array.isArray(value.contextUsed)
    ? value.contextUsed.map((item) => safeString(item)).filter(Boolean)
    : undefined;

  return {
    message: safeString(value.message ?? value.data ?? "") || "A kérés feldolgozva.",
    thoughts: typeof value.thoughts === "string" ? value.thoughts : undefined,
    contextUsed,
    executedBy:
      typeof value.executedBy === "string"
        ? value.executedBy
        : fallbackExecutedBy,
  };
}
