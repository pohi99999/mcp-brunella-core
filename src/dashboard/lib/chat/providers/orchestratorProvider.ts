import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";
import { toChatOutput } from "./utils";

export const orchestratorProvider: ChatProvider = {
  mode: "orchestrator",

  async send(input) {
    const response = await api.orchestrateTask(input.text, {
      chatMode: "orchestrator",
      history: input.history.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    });

    return toChatOutput(response, "Brunella");
  },
};

