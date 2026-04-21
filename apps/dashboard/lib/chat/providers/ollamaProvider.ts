import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";

export const ollamaProvider: ChatProvider = {
  mode: "ollama",

  async send(input) {
    const message = await api.generateWithOllama(
      input.conversationPrompt,
      input.selectedModel || undefined,
    );

    return {
      message,
      executedBy: "ollama",
    };
  },
};
