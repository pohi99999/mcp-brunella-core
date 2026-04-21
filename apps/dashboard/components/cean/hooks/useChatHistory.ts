import { useState, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  taskId?: string;
  timestamp: number;
  created_at: string;
}

export interface UseChatHistoryReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  loadHistory: (sessionId: string) => Promise<void>;
  saveMessage: (sessionId: string, role: 'user' | 'assistant', content: string, taskId?: string) => Promise<string>;
  clearHistory: (sessionId: string) => Promise<void>;
}

export function useChatHistory(): UseChatHistoryReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/cean/chat/history/${sessionId}?limit=100&offset=0`);
        if (!response.ok) {
          throw new Error(`Failed to load history: ${response.statusText}`);
        }
        const data = (await response.json()) as {
          messages: ChatMessage[];
        };
        setMessages(data.messages);
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const saveMessage = useCallback(
    async (sessionId: string, role: 'user' | 'assistant', content: string, taskId?: string) => {
      try {
        const response = await fetch('/api/cean/chat/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            role,
            content,
            taskId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to save message: ${response.statusText}`);
        }

        const result = (await response.json()) as {
          id: string;
          timestamp: number;
          created_at: string;
        };

        // Add to local state
        const newMessage: ChatMessage = {
          id: result.id,
          role,
          content,
          taskId,
          timestamp: result.timestamp,
          created_at: result.created_at,
        };

        setMessages((prev) => [...prev, newMessage]);
        return result.id;
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        setError(err);
        throw e;
      }
    },
    []
  );

  const clearHistory = useCallback(async (sessionId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/cean/chat/history/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to clear history: ${response.statusText}`);
      }

      setMessages([]);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      setError(err);
      throw e;
    }
  }, []);

  return {
    messages,
    loading,
    error,
    loadHistory,
    saveMessage,
    clearHistory,
  };
}
