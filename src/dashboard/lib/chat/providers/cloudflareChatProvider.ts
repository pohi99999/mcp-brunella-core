import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";
import { toChatOutput } from "./utils";

export const cloudflareChatProvider: ChatProvider = {
  mode: "cloudflare_chat",

  async send(input) {
    const historyContext = input.history
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
    const prompt = historyContext
      ? `${historyContext}\nUser: ${input.text}`
      : input.text;

    const response = await api.generateWithWorkersAI(prompt);

    return toChatOutput(
      {
        message: response.text,
        contextUsed: [`Cloudflare Workers AI — ${response.model}`],
        executedBy: "cloudflare_workers_ai",
      },
      "cloudflare_chat",
    );
  },
};
