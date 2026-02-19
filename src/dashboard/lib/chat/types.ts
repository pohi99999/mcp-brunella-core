export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: number;
  thoughts?: string;
  contextUsed?: string[];
  executedBy?: string;
  screenshot?: string;
}

export type ChatMode =
  | "orchestrator"
  | "ollama"
  | "github"
  | "gemini"
  | "cloudflare"
  | "cloudflare_chat"
  | "master_orchestrator";

export interface ChatSendInput {
  text: string;
  history: ChatMessage[];
  conversationPrompt: string;
  selectedModel?: string;
  selectedGhModel?: string;
  selectedGeminiModel?: string;
}

export interface ChatSendOutput {
  message: string;
  thoughts?: string;
  contextUsed?: string[];
  executedBy?: string;
  screenshot?: string;
}

export interface ChatProvider {
  readonly mode: ChatMode;
  send(input: ChatSendInput): Promise<ChatSendOutput>;
}
