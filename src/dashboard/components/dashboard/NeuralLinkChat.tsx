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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <Card className="border-border/50 bg-background/50 backdrop-blur-xl flex flex-col h-full glass-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2 flex-wrap border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Robot size={18} className="text-primary" />
          Neural Link
        </CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ChatMode)}
            aria-label="Chat mód"
            className="rounded-md border border-border bg-background/50 px-2 py-1.5 text-sm"
          >
            <option value="master_orchestrator">Master Orchestrator</option>
            <option value="orchestrator">Local Orchestrator</option>
            <option value="cloudflare_chat">Cloudflare Chat</option>
            <option value="cloudflare">Cloudflare (Edge)</option>
            <option value="ollama">Ollama</option>
            <option value="github">GitHub Models</option>
            <option value="gemini">Gemini</option>
          </select>
          {(mode === "cloudflare" || mode === "cloudflare_chat") &&
            edgeStatus && (
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${
                  edgeStatus.enabled && edgeStatus.healthy
                    ? "bg-green-500/15 text-green-500 border-green-500/30"
                    : "bg-red-500/15 text-red-500 border-red-500/30"
                }`}
                title={
                  edgeStatus.enabled
                    ? edgeStatus.healthy
                      ? "Edge Connected"
                      : "Edge Unhealthy"
                    : "Edge Disabled (set EDGE_ENABLED=true)"
                }
              >
                <Circle
                  size={8}
                  weight="fill"
                  style={{
                    color:
                      edgeStatus.enabled && edgeStatus.healthy
                        ? "rgb(34, 197, 94)"
                        : "rgb(239, 68, 68)",
                  }}
                />
                <span>
                  {edgeStatus.enabled
                    ? edgeStatus.healthy
                      ? "Connected"
                      : "Unhealthy"
                    : "Disabled"}
                </span>
              </div>
            )}
          {mode === "ollama" && (
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[160px] bg-background/50 border-border shadow-none">
                <SelectValue placeholder="Modell" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m, i) => (
                  <SelectItem key={`${m.name}-${i}`} value={m.name}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {mode === "github" && (
            <Select value={selectedGhModel} onValueChange={setSelectedGhModel}>
              <SelectTrigger className="w-[200px] bg-background/50 border-border shadow-none">
                <SelectValue placeholder="GitHub Model" />
              </SelectTrigger>
              <SelectContent>
                {ghModels.map((m, i) => (
                  <SelectItem key={`${m.name}-${i}`} value={m.name}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {mode === "gemini" && (
            <Select
              value={selectedGeminiModel}
              onValueChange={setSelectedGeminiModel}
            >
              <SelectTrigger className="w-[200px] bg-background/50 border-border shadow-none">
                <SelectValue placeholder="Gemini Model" />
              </SelectTrigger>
              <SelectContent>
                {geminiModels.map((m, i) => (
                  <SelectItem key={`${m.name}-${i}`} value={m.name}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showBrowser && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setBrowserTimestamp(Date.now())}
                  aria-label="Képernyő frissítése"
                  className="text-zinc-400 hover:text-primary"
                >
                  <ArrowsClockwise size={16} className={isLoading ? "animate-spin" : ""} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Képernyő frissítése</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBrowser(!showBrowser)}
                aria-label={showBrowser ? "Bezár" : "Böngésző"}
              >
                {showBrowser ? <EyeSlash size={16} /> : <Eye size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showBrowser ? "Bezár" : "Böngésző"}</TooltipContent>
          </Tooltip>
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
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-6 py-6">
            <LiveExecutionMonitor />
            
            {messages.length === 0 && !api.getActiveTasks && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                  <Brain size={32} className="text-primary animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground/80">
                    Neural Connection established
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {mode === "orchestrator"
                      ? "Orchestrator üzemmód: Komplex feladatok delegálása ügynököknek."
                      : mode === "cloudflare_chat"
                        ? "Cloudflare Chat üzemmód: közvetlen folyamatos beszélgetés a Cloudflare chat workerrel."
                        : mode === "cloudflare"
                          ? "Cloudflare Edge üzemmód: delegálás a Cloudflare Worker felé (EDGE_ENABLED szükséges)."
                          : mode === "github"
                            ? "GitHub Models üzemmód: GPT-4.1, DeepSeek-R1, Grok 3 és más felhő modellek."
                            : mode === "gemini"
                              ? "Gemini üzemmód: Google Gemini 2.5 Pro, Flash és más modellek."
                              : "Ollama üzemmód: Közvetlen kommunikáció a lokális modellel."}
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Robot size={14} className="text-primary" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5 max-w-[85%]">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-muted/50 border border-border/50 text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
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

                  {msg.role === "assistant" &&
                    (msg.thoughts || msg.contextUsed) && (
                      <div className="flex flex-col gap-1 px-1">
                        <button
                          onClick={() => toggleThoughts(i)}
                          className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors w-fit"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${msg.thoughts ? "bg-amber-500 animate-pulse" : "bg-zinc-500"}`}
                          />
                          {expandedThoughts[i] ? "Hide Intel" : "Show Intel"}
                          {msg.executedBy && (
                            <span className="opacity-50 ml-2">
                              via {msg.executedBy}
                            </span>
                          )}
                        </button>

                        {expandedThoughts[i] && (
                          <div className="mt-2 space-y-3 animate-in fade-in duration-200">
                            {msg.thoughts && (
                              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <p className="text-[11px] italic text-amber-500/80 leading-normal">
                                  {msg.thoughts}
                                </p>
                              </div>
                            )}
                            {msg.contextUsed && msg.contextUsed.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {msg.contextUsed.map((ctx, ci) => (
                                  <div
                                    key={ci}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-mono text-blue-400"
                                  >
                                    <FileText size={10} />
                                    {ctx}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <User size={14} className="text-primary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Circle
                    size={14}
                    className="text-emerald-400 animate-pulse"
                  />
                </div>
                <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                  <p className="text-sm text-zinc-500">Válasz generálása...</p>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-zinc-800/80">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())
              }
              placeholder={
                mode === "orchestrator"
                  ? "Üzenet az Orchestratornak..."
                  : mode === "cloudflare_chat"
                    ? "Üzenet a Cloudflare Chat-nek..."
                    : mode === "cloudflare"
                      ? "Üzenet a Cloudflare Edge-nek..."
                      : mode === "github"
                        ? "Üzenet a GitHub Models-nek..."
                        : mode === "gemini"
                          ? "Üzenet a Gemini-nek..."
                          : "Üzenet az AI-nak..."
              }
              className="min-h-[60px] bg-zinc-900 border-zinc-800 resize-none"
              disabled={isLoading}
              data-testid="neural-chat-input"
            />
            <Button
              onClick={send}
              disabled={!input.trim() || isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
              aria-label="Send message"
              data-testid="neural-chat-send-button"
            >
              <PaperPlaneRight size={18} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
