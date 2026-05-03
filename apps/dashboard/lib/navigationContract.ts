export const CONDUCTOR_MONITOR_NAV = {
  id: "conductor-monitor",
  label: "Trackek állapota",
} as const;

export const PROJECT_MGMT_NAV_GROUP = {
  title: "Project Mgmt",
  items: [
    CONDUCTOR_MONITOR_NAV.id,
    "tracks",
    "suggested-tasks",
    "spec-manager",
    "tests",
    "docs-config-sot",
    "config-health",
    "mission-devex",
    "test-cadence-devex",
  ],
} as const;

export interface NavigationApiContract {
  navId: string;
  apiPaths: readonly string[];
}

export const NAVIGATION_API_CONTRACTS = [
  {
    navId: "paios",
    apiPaths: ["/api/paios/chat", "/api/paios/config", "/api/paios/status"],
  },
  {
    navId: "cloudflare",
    apiPaths: ["/api/v1/cloudflare/agents", "/api/v1/cloudflare/history", "/api/v1/cloudflare/chat"],
  },
  {
    navId: "copilot-commander",
    apiPaths: [
      "/api/v1/health",
      "/api/v1/agents/status",
      "/api/v1/tasks",
      "/api/v1/tools",
      "/api/v1/llm/status",
      "/api/v1/llm/orchestration-readiness",
      "/api/v1/memory/stats",
      "/api/v1/phoenix/event-bus/history",
      "/api/v1/tracks/status",
      "/api/v1/copilot-bridge/stats",
      "/api/v1/copilot-bridge/commands",
    ],
  },
  {
    navId: "copilot-orchestrator",
    apiPaths: ["/api/v1/copilot-orchestrator/stats", "/api/v1/copilot-orchestrator/steps", "/api/v1/orchestrator/universal"],
  },
  {
    navId: "kernel-pipeline",
    apiPaths: ["/api/v1/kernel"],
  },
  {
    navId: "hook-monitor",
    apiPaths: ["/api/v1/hooks", "/api/v1/hooks/readiness"],
  },
  {
    navId: "mcp",
    apiPaths: ["/api/v1/mcp", "/api/v1/mcp/servers", "/api/v1/mcp/manifest", "/api/v1/mcp/tools"],
  },
  {
    navId: "anythingllm-bridge",
    apiPaths: ["/api/v1/anythingllm/action", "/api/v1/anythingllm/action/audit", "/api/v1/llm/orchestration-readiness"],
  },
  {
    navId: "agent-registry-governance",
    apiPaths: ["/api/v1/registry"],
  },
] as const satisfies readonly NavigationApiContract[];
