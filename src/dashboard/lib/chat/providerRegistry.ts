import type { ChatMode, ChatProvider } from "./types";
import { orchestratorProvider } from "./providers/orchestratorProvider";
import { ollamaProvider } from "./providers/ollamaProvider";
import { githubProvider } from "./providers/githubProvider";
import { geminiProvider } from "./providers/geminiProvider";
import { cloudflareEdgeProvider } from "./providers/cloudflareEdgeProvider";
import { cloudflareChatProvider } from "./providers/cloudflareChatProvider";

const providers = new Map<ChatMode, ChatProvider>([
  ["orchestrator", orchestratorProvider],
  ["ollama", ollamaProvider],
  ["github", githubProvider],
  ["gemini", geminiProvider],
  ["cloudflare", cloudflareEdgeProvider],
  ["cloudflare_chat", cloudflareChatProvider],
]);

export function getProvider(mode: ChatMode): ChatProvider {
  const provider = providers.get(mode);
  if (!provider) {
    throw new Error(`No chat provider registered for mode: ${mode}`);
  }
  return provider;
}
