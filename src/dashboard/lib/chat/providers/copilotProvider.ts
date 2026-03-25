/**
 * Copilot CLI Bridge Provider
 *
 * Sends chat messages to the BAS backend which routes them
 * through the Bifrost Gateway "copilot" provider (file-bridge).
 * The Copilot CLI picks up request files, processes them, and writes responses.
 */
import type { ChatProvider } from "../types";

export const copilotProvider: ChatProvider = {
  mode: "copilot",

  async send(input) {
    const response = await fetch("/api/paios/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.text,
        provider: "copilot",
        model: "copilot-cli",
        systemPrompt: input.conversationPrompt,
        history: input.history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Copilot bridge error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      message?: string;
      response?: string;
      error?: string;
    };

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      message: data.message || data.response || "No response from Copilot CLI",
      executedBy: "copilot-cli",
    };
  },
};
