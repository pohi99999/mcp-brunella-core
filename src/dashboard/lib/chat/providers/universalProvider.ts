import type { ChatProvider, ChatSendInput, ChatSendOutput } from '../types';

const UNIVERSAL_API_URL = '/api/orchestrator/universal';

// Maps the internal ChatMode sub-provider to the backend provider name
function extractSubProvider(conversationPrompt: string): string {
  // The UI passes the selected sub-provider in the conversationPrompt as
  // a JSON prefix: {"__provider":"gemini",...}\n<actual prompt>
  try {
    const firstLine = conversationPrompt.split('\n')[0];
    const meta = JSON.parse(firstLine) as { __provider?: string };
    if (meta.__provider) return meta.__provider;
  } catch {
    // no meta prefix
  }
  return 'gemini';
}

function extractActualPrompt(conversationPrompt: string): string {
  try {
    const firstLine = conversationPrompt.split('\n')[0];
    const meta = JSON.parse(firstLine) as { __provider?: string };
    if (meta.__provider) {
      return conversationPrompt.slice(firstLine.length + 1);
    }
  } catch {
    // no meta prefix
  }
  return conversationPrompt;
}

export const universalProvider: ChatProvider = {
  mode: 'universal',

  async send(input: ChatSendInput): Promise<ChatSendOutput> {
    const provider = extractSubProvider(input.conversationPrompt);
    const message = extractActualPrompt(input.conversationPrompt) || input.text;

    const history = input.history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    const response = await fetch(UNIVERSAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        provider,
        model: input.selectedModel || undefined,
        conversationHistory: history
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Universal Orchestrator hiba (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      reply: string;
      actionsTriggered?: Array<{ agent: string; task: string; taskId: number; status: string }>;
      provider: string;
      thinkingMs: number;
    };

    return {
      message: data.reply,
      executedBy: `universal/${data.provider}`,
      actionsTriggered: data.actionsTriggered?.map(a => ({
        agent: a.agent,
        task: a.task,
        taskId: a.taskId,
        status: a.status as 'started' | 'completed' | 'error'
      })),
      thinkingMs: data.thinkingMs
    };
  }
};
