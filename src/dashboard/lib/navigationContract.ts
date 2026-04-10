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