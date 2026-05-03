import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";

export const geminiProvider: ChatProvider = {
  mode: "gemini",

  async send(input) {
    const message = await api.generateWithGemini(
      input.conversationPrompt,
      input.selectedGeminiModel || undefined,
    );

    return {
      message,
      executedBy: "gemini",
    };
  },
};
