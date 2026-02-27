/**
 * Neural Link Chat - Mission Control 2.0
 * Orchestratorral vagy Ollamával kommunikáció
 * - Orchestrator: executeAgent("Orchestrator", task) – delegálás, tervezés
 * - Ollama: közvetlen LLM generálás
 */

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PaperPlaneRight, Robot, User, Circle, Eye, EyeSlash, ArrowsClockwise, Microphone, SpeakerHigh } from "@phosphor-icons/react";
import { Brain, FileText } from "lucide-react";
import * as api from "@/lib/apiService";
import { toast } from "sonner";
import { buildConversationPrompt } from "@/lib/chat/contextBuilder";
import { getProvider } from "@/lib/chat/providerRegistry";
import { loadChatSession, saveChatSession } from "@/lib/chat/sessionStore";
import { LiveExecutionMonitor } from "@/components/dashboard/LiveExecutionMonitor";
import type { ChatMessage as Message, ChatMode } from "@/lib/chat/types";

export function NeuralLinkChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const restored = loadChatSession();
    return restored?.messages ?? [];
  });
  const [input, setInput] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserTimestamp, setBrowserTimestamp] = useState(Date.now());
  useEffect(() => {
    if (showBrowser) {
      const interval = setInterval(() => setBrowserTimestamp(Date.now()), 1500);
      return () => clearInterval(interval);
    }
  }, [showBrowser]);
  const [mode, setMode] = useState<ChatMode>(() => {
    const restored = loadChatSession();
    return restored?.mode ?? "orchestrator";
  });
  const [models, setModels] = useState<{ name: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const restored = loadChatSession();
    return restored?.selectedModel ?? "";
  });
  const [ghModels, setGhModels] = useState<
    { name: string; provider: string }[]
  >([]);
  const [selectedGhModel, setSelectedGhModel] = useState<string>(() => {
    const restored = loadChatSession();
    return restored?.selectedGhModel ?? "";
  });
  const [geminiModels, setGeminiModels] = useState<{ name: string }[]>([]);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(() => {
    const restored = loadChatSession();
    return restored?.selectedGeminiModel ?? "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgents, setActiveAgents] = useState<{name: string, task: string}[]>([]);
  const [expandedThoughts, setExpandedThoughts] = useState<
    Record<number, boolean>
  >({});

  // Fetch active tasks periodically
  useEffect(() => {
    const interval = setInterval(() => {
      api.getActiveTasks().then(tasks => {
        const agents = tasks.map((t: any) => ({ name: t.agent, task: t.description }));
        setActiveAgents(agents);
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  const [edgeStatus, setEdgeStatus] = useState<{
    enabled: boolean;
    healthy: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getOllamaModels()
      .then((list) => {
        setModels(list);
        if (list.length > 0) {
          setSelectedModel((prev) => prev || list[0].name);
        }
      })
      .catch(() => setModels([]));
    api
      .getGithubModels()
      .then((list) => {
        setGhModels(list);
        if (list.length > 0) {
          setSelectedGhModel((prev) => prev || list[0].name);
        }
      })
      .catch(() => setGhModels([]));
    api
      .getGeminiModels()
      .then((list) => {
        setGeminiModels(list);
        if (list.length > 0) {
          setSelectedGeminiModel((prev) => prev || list[0].name);
        }
      })
      .catch(() => setGeminiModels([]));

    // Fetch Edge status for connection indicator
    api
      .getCloudflareStatus()
      .then((status) => {
        setEdgeStatus(status.status);
      })
      .catch(() => setEdgeStatus({ enabled: false, healthy: false }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveChatSession({
        messages,
        mode,
        selectedModel,
        selectedGhModel,
        selectedGeminiModel,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [messages, mode, selectedModel, selectedGhModel, selectedGeminiModel]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleThoughts = (index: number) => {
    setExpandedThoughts((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    const userMsgTimestamp = Date.now();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: userMsgTimestamp },
    ]);
    setIsLoading(true);

    try {
      const conversationPrompt = buildConversationPrompt(messages, text);
      const provider = getProvider(mode);
      const response = await provider.send({
        text,
        history: messages,
        conversationPrompt,
        selectedModel,
        selectedGhModel,
        selectedGeminiModel,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.message,
          timestamp: Date.now(),
          thoughts: response.thoughts,
          contextUsed: response.contextUsed,
          executedBy: response.executedBy,
          screenshot: response.screenshot,
        },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Generálás sikertelen";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Hiba: ${msg}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/50 bg-background/50 backdrop-blur-xl flex flex-col h-full glass-card overflow-hidden border-0 md:border">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 md:px-6 gap-2 flex-wrap border-b border-border/50 shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base font-medium">
          <Robot size={18} className="text-primary" />
          <span className="hidden xs:inline">Neural Link</span>
        </CardTitle>
        <div className="flex items-center gap-1.5 flex-1 justify-end md:flex-initial">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ChatMode)}
            aria-label="Chat mód"
            className="rounded-md border border-border bg-background/50 px-1.5 py-1 text-xs md:text-sm max-w-[100px] xs:max-w-none"
          >
            <option value="master_orchestrator">Master</option>
            <option value="orchestrator">Local</option>
            <option value="cloudflare_chat">CF Chat</option>
            <option value="cloudflare">CF Edge</option>
            <option value="ollama">Ollama</option>
            <option value="github">GitHub</option>
            <option value="gemini">Gemini</option>
          </select>
          {(mode === "cloudflare" || mode === "cloudflare_chat") &&
            edgeStatus && (
              <div
                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium border ${
                  edgeStatus.enabled && edgeStatus.healthy
                    ? "bg-green-500/15 text-green-500 border-green-500/30"
                    : "bg-red-500/15 text-red-500 border-red-500/30"
                }`}
              >
                <Circle
                  size={6}
                  weight="fill"
                  className={edgeStatus.enabled && edgeStatus.healthy ? "text-emerald-500" : "text-red-500"}
                />
                <span className="hidden sm:inline">
                  {edgeStatus.enabled ? "Connected" : "Disabled"}
                </span>
              </div>
            )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowBrowser(!showBrowser)}>
            {showBrowser ? <EyeSlash size={16} /> : <Eye size={16} />}
          </Button>
        </div>
      </CardHeader>
      
      {activeAgents.length > 0 && (
        <div className="bg-primary/5 border-b border-border/50 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-primary uppercase tracking-tighter shrink-0">Aktív raj:</span>
          {activeAgents.map((agent, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-background/80 border border-primary/20 rounded-full px-2 py-0.5 animate-pulse shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium">{agent.name}</span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[100px] italic"> - {agent.task}</span>
            </div>
          ))}
        </div>
      )}

      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        {showBrowser && (
          <div className="border-b border-border bg-black/20 p-2 flex flex-col items-center justify-center relative min-h-[200px] max-h-[400px] overflow-hidden">
            <img src={`/api/browser/snapshot?t=${browserTimestamp}`} alt="Browser Live View" className="max-w-full h-auto max-h-[380px] object-contain border border-zinc-700 shadow-lg rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block"; }} />
            <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">LIVE</div>
          </div>
        )}
        <ScrollArea className="flex-1 px-2 md:px-4">
          <div className="space-y-4 md:space-y-6 py-4 md:py-6">
            <LiveExecutionMonitor />
            
            {messages.length === 0 && !api.getActiveTasks && (
              <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center space-y-4 px-4">
                <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                  <Brain size={32} className="text-primary animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground/80">
                    Neural Connection established
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 md:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <Robot size={14} className="text-primary" />
                  </div>
                )}
                <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "max-w-[90%] md:max-w-[80%]" : "max-w-[90%] md:max-w-[85%]"}`}>
                  <div
                    className={`rounded-2xl px-3 md:px-4 py-2 md:py-2.5 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                        : "bg-muted/50 border border-border/50 text-foreground rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed overflow-hidden break-words">
                      {msg.content}
                    </p>
                    {msg.screenshot && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-border/50">
                        <img 
                          src={msg.screenshot.startsWith('data:') ? msg.screenshot : `/api/v1/robotkez/screenshot?t=${Date.now()}`} 
                          alt="Screenshot" 
                          className="max-w-full h-auto"
                        />
                      </div>
                    )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <User size={14} className="text-primary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Circle
                    size={12}
                    className="text-emerald-400 animate-pulse"
                  />
                </div>
                <div className="bg-zinc-800/60 rounded-lg px-3 py-1.5">
                  <p className="text-xs md:text-sm text-zinc-500 italic">Gondolkodom...</p>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        <div className="p-3 md:p-4 border-t border-zinc-800/80 bg-background/80 backdrop-blur-md">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())
              }
              placeholder="Üzenet..."
              className="min-h-[44px] max-h-[150px] bg-zinc-900/50 border-zinc-800 resize-none text-sm py-3"
              disabled={isLoading}
            />
            <Button
              onClick={send}
              disabled={!input.trim() || isLoading}
              className="bg-primary hover:bg-primary/90 h-11 w-11 shrink-0 rounded-xl"
              aria-label="Küldés"
            >
              <PaperPlaneRight size={20} weight="fill" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



