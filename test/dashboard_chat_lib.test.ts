import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildConversationPrompt,
  MAX_CONTEXT_MESSAGES,
} from "../src/dashboard/lib/chat/contextBuilder";
import {
  clearChatSession,
  loadChatSession,
  saveChatSession,
} from "../src/dashboard/lib/chat/sessionStore";
import type { ChatMessage } from "../src/dashboard/lib/chat/types";

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("dashboard chat context builder", () => {
  it("returns input only when history is empty", () => {
    const prompt = buildConversationPrompt([], "Teszt üzenet");
    expect(prompt).toBe("Teszt üzenet");
  });

  it("limits context to MAX_CONTEXT_MESSAGES", () => {
    const history: ChatMessage[] = Array.from({
      length: MAX_CONTEXT_MESSAGES + 5,
    }).map((_, idx) => ({
      role: idx % 2 === 0 ? "user" : "assistant",
      content: `msg-${idx}`,
      timestamp: idx,
    }));

    const prompt = buildConversationPrompt(history, "new message");
    expect(prompt).toContain("msg-14");
    expect(prompt).not.toContain("msg-0");
    expect(prompt).toContain("Új felhasználói üzenet: new message");
  });
});

describe("dashboard chat session store", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    });
    clearChatSession();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: originalLocalStorage,
    });
  });

  it("saves and restores chat session", () => {
    saveChatSession({
      mode: "orchestrator",
      selectedModel: "llama3.1:8b",
      selectedGhModel: "gpt-4.1",
      selectedGeminiModel: "gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: "hello",
          timestamp: 123,
        },
      ],
    });

    const restored = loadChatSession();
    expect(restored).not.toBeNull();
    expect(restored?.mode).toBe("orchestrator");
    expect(restored?.messages).toHaveLength(1);
    expect(restored?.messages[0].content).toBe("hello");
  });

  it("returns null for invalid session payload", () => {
    globalThis.localStorage.setItem(
      "brunella:chat:session:v1",
      JSON.stringify({ mode: "invalid", messages: [] }),
    );

    expect(loadChatSession()).toBeNull();
  });
});
