import * as api from "@/lib/apiService";
import type { ChatProvider } from "../types";
import { toChatOutput } from "./utils";

export const cloudflareChatProvider: ChatProvider = {
  mode: "cloudflare_chat",

  async send(input) {
    const response = await api.chatWithCloudflare(
      input.text,
      input.history.map((m) => ({ role: m.role, content: m.content })),
    );

    return toChatOutput(
      {
        message: response.message,
        contextUsed: [response.endpoint || "/api/chat"],
      },
      "cloudflare_chat",
    );
  },
};
