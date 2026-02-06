// FILE: src/types/llm.ts
// PURPOSE: LLM szolgáltatók és kontextus interfészek definíciója a poliglott működéshez.

export type LLMProvider = 'ollama' | 'gemini' | 'claude' | 'openai';

export interface IConversationContext {
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  activeProvider: LLMProvider;
  projectContext: {
    cwd: string;
    openFiles: string[];
    activeTrack?: string;
  };
}

export interface IAgentAction {
  targetAgent: string; // pl. "developer", "researcher", "evaluator"
  actionType: 'query' | 'execute_task' | 'plan';
  payload: any;
}