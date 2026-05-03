import type { ChatMessage, ChatMode } from "./types";

const SESSION_KEY = "brunella:chat:session:v1";

export interface ChatSessionSnapshot {
  messages: ChatMessage[];
  mode: ChatMode;
  selectedModel: string;
  selectedGhModel: string;
  selectedGeminiModel: string;
}

function isChatMode(value: unknown): value is ChatMode {
  return (
    value === "orchestrator" ||
    value === "ollama" ||
    value === "github" ||
    value === "gemini" ||
    value === "cloudflare" ||
    value === "cloudflare_chat" ||
    value === "master_orchestrator"
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ChatMessage>;
  return (
    (v.role === "user" || v.role === "assistant") &&
    typeof v.content === "string" &&
    typeof v.timestamp === "number"
  );
}

export function loadChatSession(): ChatSessionSnapshot | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ChatSessionSnapshot>;
    if (!isChatMode(parsed.mode)) return null;
    if (!Array.isArray(parsed.messages)) return null;

    const messages = parsed.messages.filter(isChatMessage);

    return {
      mode: parsed.mode,
      messages,
      selectedModel: typeof parsed.selectedModel === "string" ? parsed.selectedModel : "",
      selectedGhModel:
        typeof parsed.selectedGhModel === "string" ? parsed.selectedGhModel : "",
      selectedGeminiModel:
        typeof parsed.selectedGeminiModel === "string"
          ? parsed.selectedGeminiModel
          : "",
    };
  } catch {
    return null;
  }
}

export function saveChatSession(snapshot: ChatSessionSnapshot): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // noop
  }
}

export function clearChatSession(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // noop
  }
}
