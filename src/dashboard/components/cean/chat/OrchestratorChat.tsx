import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Copy } from 'lucide-react';
import { useCEANSocket } from '../hooks/useCEANSocket';
import { SOCKET_EVENTS, TASK_TEMPLATES, MAX_CHAT_MESSAGES } from '../utils/constants';
import { logInfo, logError } from '../../utils/logger';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  taskId?: string;
}

export const OrchestratorChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket, connected, emit, on } = useCEANSocket();

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Socket event listener
  useEffect(() => {
    if (!socket) return;

    const handleOrchestratorResponse = (data: unknown) => {
      try {
        const response = data as {
          taskId?: string;
          content?: string;
          error?: string;
        };
        
        if (response.error) {
          logError('OrchestratorChat', response.error);
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `❌ Hiba: ${response.error}`,
              timestamp: Date.now(),
            },
          ]);
        } else if (response.content) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: response.content,
              timestamp: Date.now(),
              taskId: response.taskId,
            },
          ]);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('OrchestratorChat', msg);
      } finally {
        setIsLoading(false);
      }
    };

    on(SOCKET_EVENTS.ORCHESTRATOR_RESPONSE, handleOrchestratorResponse);

    return () => {
      if (socket) socket.off(SOCKET_EVENTS.ORCHESTRATOR_RESPONSE, handleOrchestratorResponse);
    };
  }, [socket, on]);

  const sendPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev.slice(-MAX_CHAT_MESSAGES), userMessage]);
    setInputValue('');
    setIsLoading(true);

    logInfo('OrchestratorChat', `Sending prompt: ${prompt.slice(0, 50)}`);

    emit(SOCKET_EVENTS.ORCHESTRATOR_PROMPT, {
      prompt,
      timestamp: Date.now(),
    });
  };

  const handleTemplateClick = (template: typeof TASK_TEMPLATES[0]) => {
    setExpandedTemplate(expandedTemplate === template.id ? null : template.id);
  };

  const handleSendTemplate = (template: typeof TASK_TEMPLATES[0]) => {
    sendPrompt(template.text);
    setExpandedTemplate(null);
  };

  const clearHistory = () => {
    setMessages([]);
    logInfo('OrchestratorChat', 'Chat history cleared');
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-950 border-l border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              🤖 Orchestrator Chat
            </h1>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {connected ? '🟢 Online' : '🔴 Offline'} | {messages.length} üzenet
            </p>
          </div>
          <button
            onClick={clearHistory}
            className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 transition text-red-600"
            title="Történet törlése"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <p className="text-sm">Üdvözlöm! 👋</p>
            <p className="text-xs mt-2">Válassz templates-et alul vagy írj egy kérdést.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'
                }`}
              >
                <p className="text-sm break-words">{msg.content}</p>
                <div className="flex justify-between items-center mt-2 gap-2">
                  <span className="text-xs opacity-70">
                    {new Date(msg.timestamp).toLocaleTimeString('hu-HU')}
                  </span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => copyMessage(msg.content)}
                      className="opacity-50 hover:opacity-100 transition"
                      title="Másolás"
                    >
                      <Copy size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Templates Section */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-slate-900 max-h-40 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          ⚡ Gyors parancsok:
        </div>
        <div className="space-y-2">
          {TASK_TEMPLATES.map((template) => (
            <div key={template.id}>
              <button
                onClick={() => handleTemplateClick(template)}
                className="w-full text-left px-3 py-2 rounded bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700 flex justify-between items-center"
              >
                <span>{template.label}</span>
                <span className="text-xs">{expandedTemplate === template.id ? '▼' : '▶'}</span>
              </button>
              {expandedTemplate === template.id && (
                <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded mt-1 p-2">
                  <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">{template.text}</p>
                  <button
                    onClick={() => handleSendTemplate(template)}
                    className="w-full px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition font-medium"
                  >
                    Küldés
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-slate-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendPrompt(inputValue);
              }
            }}
            placeholder="Írj egy parancsot..."
            disabled={isLoading || !connected}
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendPrompt(inputValue)}
            disabled={isLoading || !connected || !inputValue.trim()}
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            aria-label="Üzenet küldése"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          💡 Tipp: Enter = Küldés | Shift+Enter = Új sor
        </p>
      </div>
    </div>
  );
};
