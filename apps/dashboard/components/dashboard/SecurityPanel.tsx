import React, { useState, useEffect, useCallback } from "react";

interface SandboxStats {
  totalExecutions: number;
  successfulExecutions: number;
  timeouts: number;
  oomErrors: number;
  securityViolations: number;
  avgDurationMs: number;
  poolSize: number;
  activeInstances: number;
}

interface NetworkStats {
  totalChecks: number;
  allowed: number;
  denied: number;
  rateLimited: number;
  mode: string;
}

interface Violation {
  timestamp: string;
  agent: string;
  action: string;
  resource?: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface ViolationStats {
  total: number;
  byAgent: Record<string, number>;
  bySeverity: { low: number; medium: number; high: number; critical: number };
  alertThresholdReached: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
};

export function SecurityPanel() {
  const [sandboxStats, setSandboxStats] = useState<SandboxStats | null>(null);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [violationStats, setViolationStats] = useState<ViolationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "violations" | "rbac">("overview");

  const fetchData = useCallback(async () => {
    try {
      const [sbRes, netRes, violRes, vstatsRes] = await Promise.allSettled([
        fetch("/api/v1/security/sandbox/stats"),
        fetch("/api/v1/security/network/stats"),
        fetch("/api/v1/security/violations?limit=50"),
        fetch("/api/v1/security/violations/stats"),
      ]);

      if (sbRes.status === "fulfilled" && sbRes.value.ok) setSandboxStats(await sbRes.value.json());
      if (netRes.status === "fulfilled" && netRes.value.ok) setNetworkStats(await netRes.value.json());
      if (violRes.status === "fulfilled" && violRes.value.ok) setViolations(await violRes.value.json());
      if (vstatsRes.status === "fulfilled" && vstatsRes.value.ok) setViolationStats(await vstatsRes.value.json());
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div style={{ padding: 24, color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 28 }}>🔒</span>
        <h2 style={{ margin: 0, fontSize: 22 }}>Security & Sandbox Monitor</h2>
        <button onClick={fetchData} style={btnStyle}>🔄 Frissítés</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["overview", "violations", "rbac"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ ...tabStyle, ...(activeTab === tab ? activeTabStyle : {}) }}>
            {tab === "overview" ? "📊 Áttekintés" : tab === "violations" ? "⚠️ Sértések" : "🛡️ RBAC Térkép"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Betöltés...</p>
      ) : activeTab === "overview" ? (
        <OverviewTab sandbox={sandboxStats} network={networkStats} vStats={violationStats} />
      ) : activeTab === "violations" ? (
        <ViolationsTab violations={violations} stats={violationStats} />
      ) : (
        <RBACTab />
      )}
    </div>
  );
}

function OverviewTab({ sandbox, network, vStats }: {
  sandbox: SandboxStats | null; network: NetworkStats | null; vStats: ViolationStats | null;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      {/* Sandbox Stats */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>🏖️ Sandbox</h3>
        {sandbox ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatItem label="Futtatások" value={sandbox.totalExecutions} />
            <StatItem label="Sikeres" value={sandbox.successfulExecutions} color="#22c55e" />
            <StatItem label="Timeout" value={sandbox.timeouts} color="#f59e0b" />
            <StatItem label="OOM" value={sandbox.oomErrors} color="#ef4444" />
            <StatItem label="Bizt. sértés" value={sandbox.securityViolations} color="#dc2626" />
            <StatItem label="Átl. idő" value={`${sandbox.avgDurationMs}ms`} />
            <StatItem label="Pool méret" value={sandbox.poolSize} />
            <StatItem label="Aktív" value={sandbox.activeInstances} />
          </div>
        ) : <p style={{ opacity: 0.5, fontSize: 13 }}>Nincs adat — sandbox inaktív</p>}
      </div>

      {/* Network Policy */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>🌐 Hálózati Szabályzat</h3>
        {network ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatItem label="Ellenőrzés" value={network.totalChecks} />
            <StatItem label="Engedélyezett" value={network.allowed} color="#22c55e" />
            <StatItem label="Tiltott" value={network.denied} color="#ef4444" />
            <StatItem label="Rate limit" value={network.rateLimited} color="#f59e0b" />
            <StatItem label="Mód" value={network.mode} />
          </div>
        ) : <p style={{ opacity: 0.5, fontSize: 13 }}>Nincs adat — policy inaktív</p>}
      </div>

      {/* Violation Summary */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>⚠️ Sértések összesítő</h3>
        {vStats ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatItem label="Összesen" value={vStats.total} />
              <StatItem label="Kritikus" value={vStats.bySeverity.critical} color="#dc2626" />
              <StatItem label="Magas" value={vStats.bySeverity.high} color="#ef4444" />
              <StatItem label="Közepes" value={vStats.bySeverity.medium} color="#f59e0b" />
            </div>
            {vStats.alertThresholdReached && (
              <div style={{ marginTop: 12, padding: 8, background: "#7f1d1d", borderRadius: 6, fontSize: 13, textAlign: "center" }}>
                🚨 FIGYELEM: Alert küszöb elérve!
              </div>
            )}
          </div>
        ) : <p style={{ opacity: 0.5, fontSize: 13 }}>Nincs sértés</p>}
      </div>
    </div>
  );
}

function ViolationsTab({ violations, stats }: { violations: Violation[]; stats: ViolationStats | null }) {
  return (
    <div>
      {/* Agent-based breakdown */}
      {stats && Object.keys(stats.byAgent).length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h3 style={cardTitleStyle}>Sértések ügynökönként</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(stats.byAgent).sort((a, b) => b[1] - a[1]).map(([agent, count]) => (
              <span key={agent} style={{ background: "#374151", padding: "4px 10px", borderRadius: 12, fontSize: 13 }}>
                {agent}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Violation timeline */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Utolsó 50 sértés</h3>
        {violations.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: 13 }}>✅ Nincs sértés — rendszer tiszta</p>
        ) : (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #374151" }}>
                  <th style={thStyle}>Idő</th><th style={thStyle}>Szint</th><th style={thStyle}>Ügynök</th>
                  <th style={thStyle}>Művelet</th><th style={thStyle}>Ok</th>
                </tr>
              </thead>
              <tbody>
                {violations.slice().reverse().map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1f2937" }}>
                    <td style={tdStyle}>{new Date(v.timestamp).toLocaleTimeString("hu-HU")}</td>
                    <td style={tdStyle}>
                      <span style={{ ...badgeStyle, background: SEVERITY_COLORS[v.severity] }}>{v.severity}</span>
                    </td>
                    <td style={tdStyle}>{v.agent}</td>
                    <td style={tdStyle}>{v.action}</td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{v.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RBACTab() {
  const profiles = [
    { name: "ADMIN", role: "admin", agents: "Orchestrator, CopilotBridge", tools: "* (minden)", color: "#dc2626" },
    { name: "DEVELOPER", role: "developer", agents: "DeveloperAgent, CodeReviewer, LintFixer", tools: "read/write_file, run_command, git", color: "#3b82f6" },
    { name: "RESEARCHER", role: "researcher", agents: "ResearcherAgent, BifrostGateway", tools: "read_file, search, http", color: "#8b5cf6" },
    { name: "EVALUATOR", role: "evaluator", agents: "EvaluatorAgent", tools: "read_file, run_tests", color: "#22c55e" },
    { name: "ROBOTKEZ", role: "robotkez", agents: "RobotkezV2", tools: "browser_*, write_file", color: "#f59e0b" },
    { name: "READONLY", role: "readonly", agents: "Ismeretlen ügynökök (default)", tools: "read_file, search", color: "#6b7280" },
  ];

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>🛡️ RBAC Jogosultsági Térkép</h3>
      <div style={{ display: "grid", gap: 12 }}>
        {profiles.map(p => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#1f2937", borderRadius: 8, borderLeft: `4px solid ${p.color}` }}>
            <div style={{ minWidth: 100 }}>
              <strong style={{ color: p.color }}>{p.name}</strong>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{p.role}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Ügynökök: {p.agents}</div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>Eszközök: {p.tools}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "#e2e8f0" }}>{value}</div>
    </div>
  );
}

// Styles
const cardStyle: React.CSSProperties = { background: "#111827", borderRadius: 12, padding: 20, border: "1px solid #1f2937" };
const cardTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 14 };
const btnStyle: React.CSSProperties = { background: "#1f2937", color: "#e2e8f0", border: "1px solid #374151", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 };
const tabStyle: React.CSSProperties = { background: "#1f2937", color: "#9ca3af", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500 };
const activeTabStyle: React.CSSProperties = { background: "#374151", color: "#e2e8f0" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontWeight: 600, opacity: 0.7 };
const tdStyle: React.CSSProperties = { padding: "6px 8px", whiteSpace: "nowrap" };
const badgeStyle: React.CSSProperties = { padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, color: "#fff" };

export default SecurityPanel;
