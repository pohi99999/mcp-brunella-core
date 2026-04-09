export const missionSurfaceValues = ["api", "cli", "dashboard", "track", "docs", "mixed"] as const;
export type MissionSurface = (typeof missionSurfaceValues)[number];

export const testCadenceTierValues = ["minimal", "recommended", "full"] as const;
export type TestCadenceTier = (typeof testCadenceTierValues)[number];

export const missionSurfaceLabels: Record<MissionSurface, string> = {
  api: "API / backend",
  cli: "CLI / ops",
  dashboard: "Dashboard / UI",
  track: "Track / conductor",
  docs: "Docs / config",
  mixed: "Mixed / cross-cutting",
};

export const testCadenceTierLabels: Record<TestCadenceTier, string> = {
  minimal: "Minimal",
  recommended: "Recommended",
  full: "Full",
};

export function isMissionSurface(value: string): value is MissionSurface {
  return missionSurfaceValues.includes(value as MissionSurface);
}

export function isTestCadenceTier(value: string): value is TestCadenceTier {
  return testCadenceTierValues.includes(value as TestCadenceTier);
}

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  goal: string;
  surface: MissionSurface;
  category: string;
  tags: string[];
  steps: string[];
  commands: string[];
  artifacts: string[];
  trackRefs: string[];
}

export interface DevExRecommendation {
  id: string;
  target: "mission" | "cadence" | "combined";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  rationale: string;
  evidence: string[];
  actions: string[];
}

export interface TestCadenceTierAdvice {
  tier: TestCadenceTier;
  title: string;
  rationale: string;
  commands: string[];
}

export interface TestCadenceAdvice {
  surface: MissionSurface;
  defaultTier: TestCadenceTier;
  selectedTier: TestCadenceTier;
  score: number;
  status: "healthy" | "warning" | "critical";
  tiers: TestCadenceTierAdvice[];
  recommendedCommands: string[];
  warnings: string[];
}

export interface DevExPlannerMission {
  templateId: string;
  title: string;
  description: string;
  goal: string;
  surface: MissionSurface;
  category: string;
  tags: string[];
  steps: string[];
  commands: string[];
  artifacts: string[];
  trackRefs: string[];
}

export interface DevExPlannerSummary {
  score: number;
  status: "healthy" | "warning" | "critical";
  missionScore: number;
  cadenceScore: number;
  templateCount: number;
  selectedSurface: MissionSurface;
  selectedTemplateId: string;
}

export interface DevExPlannerSnapshot {
  checkedAt: string;
  templates: MissionTemplate[];
  selectedTemplate: MissionTemplate;
  mission: DevExPlannerMission;
  testCadence: TestCadenceAdvice;
  summary: DevExPlannerSummary;
  warnings: string[];
  recommendations: DevExRecommendation[];
}

export interface DevExPlannerResponse {
  success: boolean;
  snapshot: DevExPlannerSnapshot;
  markdown: string;
}
