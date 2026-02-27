import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";

export const githubProvider: ChatProvider = {
  mode: "github",

  async send(input) {
    const message = await api.generateWithGithubModels(
      input.conversationPrompt,
      input.selectedGhModel || undefined,
    );

    return {
      message,
      executedBy: "github",
    };
  },
};
