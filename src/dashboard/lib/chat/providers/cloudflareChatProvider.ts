import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";
import { toChatOutput } from "./utils";

const CF_SYSTEM_PROMPT =
  "Te Brunella vagy, az MCP Brunella Core rendszer AI asszisztense. Válaszolj természetesen, magyarul, professzionálisan és segítőkészen.";

export const cloudflareChatProvider: ChatProvider = {
  mode: "cloudflare_chat",

  async send(input) {
    const historyContext = input.history
      .map((m) => `${m.role === "user" ? "Felhasználó" : "Asszisztens"}: ${m.content}`)
      .join("\n");
    const prompt = [
      CF_SYSTEM_PROMPT,
      "",
      historyContext ? `${historyContext}\nFelhasználó: ${input.text}` : `Felhasználó: ${input.text}`,
    ].join("\n");

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
