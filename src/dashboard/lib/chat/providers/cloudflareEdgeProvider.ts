import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";
import { toChatOutput } from "./utils";

const CF_SYSTEM_PROMPT =
  "Te Brunella vagy, az MCP Brunella Core rendszer AI asszisztense. Válaszolj természetesen, magyarul, professzionálisan és segítőkészen.";

export const cloudflareEdgeProvider: ChatProvider = {
  mode: "cloudflare",

  async send(input) {
    const edge = await api.submitCloudflareTask(
      `${CF_SYSTEM_PROMPT}\n\nFelhasználó: ${input.text}`,
      {
        history: input.history.map((m) => ({ role: m.role, content: m.content })),
      },
    );

    const result =
      typeof edge.result === "string"
        ? edge.result
        : typeof edge.result === "object" && edge.result !== null
          ? (edge.result as Record<string, unknown>).response ?? edge.result
          : edge.message;

    return toChatOutput({ message: result }, "cloudflare");
  },
};
