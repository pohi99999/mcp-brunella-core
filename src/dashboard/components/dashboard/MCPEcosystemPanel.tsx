import React, { useState, useEffect, useCallback, useRef } from "react";
import { ScrollArea } from "../ui/scroll-area";
import {
  Search,
  RefreshCw,
  BookOpen,
  X,
  Copy,
  Check,
  Server,
  Wrench,
  Zap,
  Eye,
  Activity,
  Cpu,
  Database,
  Network,
  BarChart3,
  Brain,
  GitBranch,
  Terminal,
  Shield,
  Workflow,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category?: string;
  readOnly?: boolean;
}

interface MCPServer {
  id: string;
  label: string;
  description: string;
  toolCount: number;
  status: "connected" | "degraded" | "offline" | "unknown";
  tools: MCPTool[];
  icon: React.ReactNode;
  color: string;
}

// ── Static catalog ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  "task_queue": {
    icon: <Workflow size={13} />,
    color: "#f59e0b",
    label: "Task Queue",
  },
  "scheduled": {
    icon: <Activity size={13} />,
    color: "#f59e0b",
    label: "Ütemezett feladatok",
  },
  "workflow": {
    icon: <GitBranch size={13} />,
    color: "#f59e0b",
    label: "Workflow",
  },
  "agent_status": {
    icon: <Cpu size={13} />,
    color: "#06b6d4",
    label: "Agent státusz",
  },
  "llm": {
    icon: <Brain size={13} />,
    color: "#06b6d4",
    label: "LLM telemetria",
  },
  "tool_stats": {
    icon: <BarChart3 size={13} />,
    color: "#06b6d4",
    label: "Tool statisztikák",
  },
  "webhook": {
    icon: <Network size={13} />,
    color: "#06b6d4",
    label: "Webhook",
  },
  "fleet": {
    icon: <Server size={13} />,
    color: "#06b6d4",
    label: "Flotta",
  },
  "learning": {
    icon: <Brain size={13} />,
    color: "#a78bfa",
    label: "Learning Loop",
  },
  "reflex": {
    icon: <Zap size={13} />,
    color: "#a78bfa",
    label: "Reflex modell",
  },
  "golden": {
    icon: <Database size={13} />,
    color: "#a78bfa",
    label: "Golden dataset",
  },
  "n8n": {
    icon: <Workflow size={13} />,
    color: "#f97316",
    label: "n8n",
  },
  "default": {
    icon: <Wrench size={13} />,
    color: "#6b7280",
    label: "Általános",
  },
};

function detectCategory(toolName: string): string {
  if (toolName.startsWith("task_queue")) return "task_queue";
  if (toolName.startsWith("scheduled")) return "scheduled";
  if (toolName.startsWith("task_workflow")) return "workflow";
  if (toolName.startsWith("agent_status") || toolName.startsWith("agent_diag")) return "agent_status";
  if (toolName.startsWith("llm_call")) return "llm";
  if (toolName.startsWith("tool_run")) return "tool_stats";
  if (toolName.startsWith("webhook")) return "webhook";
  if (toolName.startsWith("fleet")) return "fleet";
  if (toolName.startsWith("learning_snapshots") || toolName.startsWith("learning_training") || toolName.startsWith("learning_eval")) return "learning";
  if (toolName.startsWith("learning_model") || toolName.startsWith("learning_active") || toolName.startsWith("learning_rollback")) return "reflex";
  if (toolName.startsWith("learning_golden")) return "golden";
  if (toolName.startsWith("n8n")) return "n8n";
  return "default";
}

const STATIC_SERVERS: Omit<MCPServer, "tools" | "toolCount" | "status">[] = [
  {
    id: "brunella-core",
    label: "brunella-core",
    description: "Fő Brunella MCP szerver — task, observability, learning tools",
    icon: <Shield size={16} />,
    color: "#06b6d4",
  },
  {
    id: "n8n-server",
    label: "n8n-mcp-server",
    description: "n8n workflow automation — workflows, executions, credentials",
    icon: <Workflow size={16} />,
    color: "#f97316",
  },
  {
    id: "python-mcp",
    label: "brunella-python",
    description: "Python FastMCP — RAG, harvest, browser-use, vector",
    icon: <Terminal size={16} />,
    color: "#a78bfa",
  },
  {
    id: "playwright",
    label: "playwright",
    description: "Browser automatizáció — screenshot, click, form, navigate",
    icon: <Eye size={16} />,
    color: "#10b981",
  },
  {
    id: "chrome-devtools",
    label: "chrome-devtools",
    description: "Chrome CDP debug — console, network, performance profiling",
    icon: <Search size={16} />,
    color: "#f59e0b",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSchemaPreview(schema: Record<string, unknown>): string {
  try {
    return JSON.stringify(schema, null, 2);
  } catch {
    return "{}";
  }
}

function groupToolsByCategory(tools: MCPTool[]): Record<string, MCPTool[]> {
  const groups: Record<string, MCPTool[]> = {};
  for (const tool of tools) {
    const cat = detectCategory(tool.name);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(tool);
  }
  return groups;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: MCPServer["status"] }) {
  const colors: Record<string, string> = {
    connected: "#10b981",
    degraded: "#f59e0b",
    offline: "#ef4444",
    unknown: "#6b7280",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: colors[status] ?? "#6b7280",
        boxShadow: status === "connected" ? `0 0 6px ${colors.connected}88` : "none",
        flexShrink: 0,
      }}
    />
  );
}

function PulsingDot() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#10b981",
        animation: "mcpPulse 1.8s ease-in-out infinite",
        flexShrink: 0,
      }}
    />
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: copied ? "#10b981" : "#6b7280",
        padding: "2px 4px",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        transition: "color 0.2s",
      }}
      title="Másolás"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function MCPEcosystemPanel() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("brunella-core");
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [totalTools, setTotalTools] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const mountRef = useRef(false);

  // Fetch tools from brunella-core endpoint
  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/v1/mcp/tools");
      const data = await resp.json() as { success?: boolean; tools?: MCPTool[] };
      const rawTools: MCPTool[] = data.tools ?? [];

      // Build server catalog with real brunella-core tools
      const builtServers: MCPServer[] = STATIC_SERVERS.map((srv) => {
        if (srv.id === "brunella-core") {
          return {
            ...srv,
            tools: rawTools,
            toolCount: rawTools.length,
            status: rawTools.length > 0 ? "connected" : "degraded",
          };
        }
        // Static mock for external servers
        const mockTools: MCPTool[] = getMockTools(srv.id);
        return {
          ...srv,
          tools: mockTools,
          toolCount: mockTools.length,
          status: "unknown" as const,
        };
      });

      setServers(builtServers);
      const total = builtServers.reduce((s, srv) => s + srv.toolCount, 0);
      setTotalTools(total);
      setLiveCount(builtServers.filter((s) => s.status === "connected").length);
      setLastRefresh(new Date());
    } catch {
      // Build with empty tools if API unavailable
      const fallback: MCPServer[] = STATIC_SERVERS.map((srv) => ({
        ...srv,
        tools: getMockTools(srv.id),
        toolCount: getMockTools(srv.id).length,
        status: "offline" as const,
      }));
      setServers(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current) {
      mountRef.current = true;
      fetchTools();
    }
  }, [fetchTools]);

  const activeServer = servers.find((s) => s.id === selectedServer);
  const filteredTools = (activeServer?.tools ?? []).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  const grouped = groupToolsByCategory(filteredTools);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&display=swap');

        @keyframes mcpPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes mcpFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mcpSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes mcpScanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .mcp-panel * { box-sizing: border-box; }
        .mcp-panel { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
        .mcp-tool-row:hover { background: rgba(6,182,212,0.07) !important; }
        .mcp-server-row:hover { background: rgba(255,255,255,0.04) !important; }
        .mcp-server-row.active { background: rgba(6,182,212,0.1) !important; border-left: 2px solid #06b6d4 !important; }
        .mcp-schema-code::-webkit-scrollbar { width: 4px; height: 4px; }
        .mcp-schema-code::-webkit-scrollbar-track { background: transparent; }
        .mcp-schema-code::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
      `}</style>

      <div
        className="mcp-panel"
        style={{
          background: "#080b10",
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          color: "#e2e8f0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Top header bar */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            borderBottom: "1px solid #1a2030",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(8,11,16,0.95)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ color: "#06b6d4" }}>◈</span>
              <span style={{ color: "#f1f5f9" }}>MCP</span>
              <span style={{ color: "#64748b", fontWeight: 400 }}>Ecosystem</span>
            </div>
            <div
              style={{
                height: 20,
                width: 1,
                background: "#1e293b",
              }}
            />
            {/* Stats pills */}
            <div style={{ display: "flex", gap: 8 }}>
              <StatPill
                value={servers.length}
                label="szerver"
                color="#06b6d4"
              />
              <StatPill
                value={totalTools}
                label="tool"
                color="#f59e0b"
              />
              <StatPill
                value={liveCount}
                label="online"
                color="#10b981"
                pulse
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
              {lastRefresh.toLocaleTimeString("hu-HU")}
            </span>
            <button
              onClick={fetchTools}
              style={{
                background: "rgba(6,182,212,0.08)",
                border: "1px solid rgba(6,182,212,0.2)",
                borderRadius: 6,
                color: "#06b6d4",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                transition: "background 0.2s",
              }}
              title="Frissítés"
            >
              <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              sync
            </button>
          </div>
        </div>

        {/* Main 3-column layout */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            display: "grid",
            gridTemplateColumns: "220px 1fr",
            gridTemplateRows: selectedTool ? "1fr 260px" : "1fr",
            overflow: "hidden",
          }}
        >
          {/* ── Left: Server list ─────────────────────────────── */}
          <div
            style={{
              borderRight: "1px solid #1a2030",
              display: "flex",
              flexDirection: "column",
              gridRow: "1 / -1",
              background: "rgba(10,13,18,0.6)",
            }}
          >
            <div
              style={{
                padding: "10px 14px 8px",
                borderBottom: "1px solid #1a2030",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "#475569",
                textTransform: "uppercase",
                fontFamily: "'Syne', sans-serif",
              }}
            >
              Szerverek
            </div>
            <ScrollArea style={{ flex: 1 }}>
              {servers.map((srv, i) => (
                <div
                  key={srv.id}
                  className={`mcp-server-row ${selectedServer === srv.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedServer(srv.id);
                    setSelectedTool(null);
                    setSearchQuery("");
                  }}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderLeft: "2px solid transparent",
                    transition: "all 0.15s",
                    animation: `mcpSlideIn 0.3s ease ${i * 0.05}s both`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: srv.color, opacity: 0.85, flexShrink: 0 }}>
                      {srv.icon}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: selectedServer === srv.id ? "#e2e8f0" : "#94a3b8",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {srv.label}
                    </span>
                    <StatusDot status={srv.status} />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: "#475569",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 130,
                      }}
                    >
                      {srv.description.split("—")[0].trim()}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: srv.color,
                        background: `${srv.color}18`,
                        padding: "1px 6px",
                        borderRadius: 10,
                        flexShrink: 0,
                      }}
                    >
                      {srv.toolCount}
                    </span>
                  </div>
                </div>
              ))}
            </ScrollArea>

            {/* Bottom status */}
            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid #1a2030",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <PulsingDot />
              <span style={{ fontSize: 9, color: "#10b981", letterSpacing: "0.05em" }}>
                MCP PROTOCOL ACTIVE
              </span>
            </div>
          </div>

          {/* ── Right: Tool list ──────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              gridColumn: 2,
              gridRow: 1,
            }}
          >
            {/* Tool panel header */}
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #1a2030",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(10,13,18,0.6)",
              }}
            >
              <span
                style={{ color: activeServer?.color ?? "#64748b", flexShrink: 0 }}
              >
                {activeServer?.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#e2e8f0",
                    fontFamily: "'Syne', sans-serif",
                  }}
                >
                  {activeServer?.label ?? "—"}
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>
                  {activeServer?.description}
                </div>
              </div>
              {/* Search */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#111827",
                  border: "1px solid #1e293b",
                  borderRadius: 6,
                  padding: "4px 10px",
                  gap: 6,
                  width: 200,
                }}
              >
                <Search size={11} style={{ color: "#475569", flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="szűrés..."
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#94a3b8",
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    width: "100%",
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#475569",
                      padding: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: "#475569",
                  background: "#111827",
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "1px solid #1e293b",
                  flexShrink: 0,
                }}
              >
                {filteredTools.length} tool
              </span>
            </div>

            {/* Tool list body */}
            <ScrollArea style={{ flex: 1 }}>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 200,
                    gap: 12,
                  }}
                >
                  <PulsingDot />
                  <span style={{ fontSize: 11, color: "#475569" }}>Betöltés…</span>
                </div>
              ) : Object.keys(grouped).length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 160,
                    color: "#475569",
                    fontSize: 11,
                  }}
                >
                  {searchQuery ? "Nincs találat" : "Nincsenek eszközök"}
                </div>
              ) : (
                <div style={{ padding: "8px 0" }}>
                  {Object.entries(grouped).map(([cat, catTools], gi) => {
                    const meta = CATEGORY_META[cat] ?? CATEGORY_META["default"];
                    return (
                      <div
                        key={cat}
                        style={{
                          animation: `mcpFadeIn 0.3s ease ${gi * 0.05}s both`,
                        }}
                      >
                        {/* Category header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            padding: "8px 16px 4px",
                            color: meta.color,
                          }}
                        >
                          {meta.icon}
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              fontFamily: "'Syne', sans-serif",
                            }}
                          >
                            {meta.label}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              color: "#374151",
                              marginLeft: 2,
                            }}
                          >
                            ({catTools.length})
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: 1,
                              background: `${meta.color}22`,
                              marginLeft: 4,
                            }}
                          />
                        </div>
                        {/* Tools */}
                        {catTools.map((tool) => (
                          <ToolRow
                            key={tool.name}
                            tool={tool}
                            selected={selectedTool?.name === tool.name}
                            accentColor={meta.color}
                            onClick={() =>
                              setSelectedTool(
                                selectedTool?.name === tool.name ? null : tool
                              )
                            }
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ── Bottom: Schema inspector ──────────────────────── */}
          {selectedTool && (
            <div
              style={{
                gridColumn: 2,
                gridRow: 2,
                borderTop: "1px solid #1a2030",
                background: "#080c13",
                display: "flex",
                flexDirection: "column",
                animation: "mcpFadeIn 0.2s ease both",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  borderBottom: "1px solid #1a2030",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <BookOpen size={12} style={{ color: "#06b6d4" }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#06b6d4",
                    fontFamily: "'Syne', sans-serif",
                    flex: 1,
                  }}
                >
                  {selectedTool.name}
                  <span
                    style={{
                      fontWeight: 400,
                      color: "#475569",
                      marginLeft: 8,
                    }}
                  >
                    — input schema
                  </span>
                </span>
                <CopyButton text={formatSchemaPreview(selectedTool.inputSchema)} />
                <button
                  onClick={() => setSelectedTool(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#475569",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={13} />
                </button>
              </div>
              <ScrollArea style={{ flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, height: "100%" }}>
                  {/* Description */}
                  <div
                    style={{
                      padding: "10px 16px",
                      borderRight: "1px solid #1a2030",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 6,
                        fontFamily: "'Syne', sans-serif",
                      }}
                    >
                      Leírás
                    </div>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {selectedTool.description}
                    </p>
                    {selectedTool.readOnly !== undefined && (
                      <div style={{ marginTop: 8 }}>
                        <span
                          style={{
                            fontSize: 9,
                            padding: "2px 7px",
                            borderRadius: 3,
                            background: selectedTool.readOnly ? "#10b98118" : "#f59e0b18",
                            color: selectedTool.readOnly ? "#10b981" : "#f59e0b",
                            border: `1px solid ${selectedTool.readOnly ? "#10b98130" : "#f59e0b30"}`,
                          }}
                        >
                          {selectedTool.readOnly ? "READ-ONLY" : "MUTATION"}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Schema JSON */}
                  <div style={{ padding: "10px 16px" }}>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 6,
                        fontFamily: "'Syne', sans-serif",
                      }}
                    >
                      JSON Schema
                    </div>
                    <pre
                      className="mcp-schema-code"
                      style={{
                        margin: 0,
                        fontSize: 10,
                        color: "#7dd3fc",
                        background: "#0a0e16",
                        padding: "8px 10px",
                        borderRadius: 5,
                        border: "1px solid #1e293b",
                        overflow: "auto",
                        maxHeight: 160,
                        fontFamily: "'JetBrains Mono', monospace",
                        lineHeight: 1.5,
                      }}
                    >
                      {formatSchemaPreview(selectedTool.inputSchema)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({
  value,
  label,
  color,
  pulse = false,
}: {
  value: number;
  label: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: `${color}10`,
        border: `1px solid ${color}28`,
        borderRadius: 6,
        padding: "3px 9px",
        fontSize: 10,
      }}
    >
      {pulse ? <PulsingDot /> : <span style={{ color, fontSize: 11, lineHeight: 1 }}>●</span>}
      <span style={{ color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </span>
      <span style={{ color: "#475569" }}>{label}</span>
    </div>
  );
}

// ── ToolRow ───────────────────────────────────────────────────────────────────

function ToolRow({
  tool,
  selected,
  accentColor,
  onClick,
}: {
  tool: MCPTool;
  selected: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  const paramCount = Object.keys(
    (tool.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {}
  ).length;

  return (
    <div
      className="mcp-tool-row"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "7px 16px",
        cursor: "pointer",
        borderLeft: selected ? `2px solid ${accentColor}` : "2px solid transparent",
        background: selected ? `${accentColor}0a` : "transparent",
        transition: "all 0.12s",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: selected ? accentColor : "#334155",
          fontWeight: 600,
          flexShrink: 0,
          transition: "color 0.12s",
        }}
      >
        ›
      </span>
      <span
        style={{
          fontSize: 11,
          color: selected ? "#e2e8f0" : "#94a3b8",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: selected ? 500 : 400,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {tool.name}
      </span>
      <span
        style={{
          fontSize: 9,
          color: "#475569",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 220,
          textAlign: "right",
          flex: 0,
          flexBasis: 200,
        }}
      >
        {tool.description.length > 50
          ? tool.description.slice(0, 50) + "…"
          : tool.description}
      </span>
      {paramCount > 0 && (
        <span
          style={{
            fontSize: 9,
            color: accentColor,
            background: `${accentColor}12`,
            padding: "1px 5px",
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          {paramCount}p
        </span>
      )}
    </div>
  );
}

// ── Mock tools for external servers ──────────────────────────────────────────

function getMockTools(serverId: string): MCPTool[] {
  const mocks: Record<string, MCPTool[]> = {
    "n8n-server": [
      { name: "n8n_workflow_list", description: "List all n8n workflows with status and metadata", inputSchema: { type: "object", properties: { active: { type: "boolean" } } } },
      { name: "n8n_workflow_get", description: "Get a specific workflow by ID", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
      { name: "n8n_workflow_create", description: "Create a new n8n workflow", inputSchema: { type: "object", properties: { name: { type: "string" }, nodes: { type: "array" } } } },
      { name: "n8n_workflow_execute", description: "Manually trigger a workflow execution", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
      { name: "n8n_execution_list", description: "List workflow executions", inputSchema: { type: "object", properties: { workflowId: { type: "string" }, limit: { type: "number" } } } },
      { name: "n8n_execution_get", description: "Get details of a specific execution", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
      { name: "n8n_credential_list", description: "List available n8n credentials", inputSchema: { type: "object", properties: {} } },
      { name: "n8n_webhook_trigger", description: "Trigger a workflow via webhook", inputSchema: { type: "object", properties: { path: { type: "string" }, payload: { type: "object" } } } },
    ],
    "python-mcp": [
      { name: "rag_query", description: "Query the RAG knowledge base with semantic search", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
      { name: "harvest_run", description: "Run a harvest scenario", inputSchema: { type: "object", properties: { scenario: { type: "string" } }, required: ["scenario"] } },
      { name: "browser_navigate", description: "Navigate browser to a URL using browser-use", inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
      { name: "vector_search", description: "Search the LanceDB vector index", inputSchema: { type: "object", properties: { query: { type: "string" }, collection: { type: "string" } } } },
      { name: "python_execute", description: "Execute Python code in sandboxed environment", inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } },
    ],
    "playwright": [
      { name: "playwright_screenshot", description: "Take a screenshot of a URL", inputSchema: { type: "object", properties: { url: { type: "string" }, fullPage: { type: "boolean" } }, required: ["url"] } },
      { name: "playwright_click", description: "Click an element on the page", inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] } },
      { name: "playwright_fill", description: "Fill a form field", inputSchema: { type: "object", properties: { selector: { type: "string" }, value: { type: "string" } } } },
      { name: "playwright_navigate", description: "Navigate to a URL", inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
      { name: "playwright_evaluate", description: "Execute JavaScript in page context", inputSchema: { type: "object", properties: { script: { type: "string" } }, required: ["script"] } },
    ],
    "chrome-devtools": [
      { name: "cdp_console_logs", description: "Capture browser console logs via CDP", inputSchema: { type: "object", properties: { tabId: { type: "string" } } } },
      { name: "cdp_network_requests", description: "Monitor network requests", inputSchema: { type: "object", properties: { filter: { type: "string" } } } },
      { name: "cdp_performance_profile", description: "Start/stop performance profiling", inputSchema: { type: "object", properties: { action: { type: "string" } }, required: ["action"] } },
      { name: "cdp_dom_query", description: "Query DOM elements via CDP", inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] } },
    ],
  };
  return mocks[serverId] ?? [];
}

export default MCPEcosystemPanel;
