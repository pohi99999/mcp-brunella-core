import {
  missionSurfaceLabels,
  testCadenceTierLabels,
  testCadenceTierValues,
  type DevExPlannerSnapshot,
  type MissionSurface,
  type TestCadenceAdvice,
  type TestCadenceTier,
} from "./devExTypes.js";

type SurfaceProfile = {
  defaultTier: TestCadenceTier;
  notes: string;
  tierCommands: Record<TestCadenceTier, string[]>;
  tierRationales: Record<TestCadenceTier, string>;
};

const surfaceProfiles: Record<MissionSurface, SurfaceProfile> = {
  api: {
    defaultTier: "recommended",
    notes: "Backend and route work should always run the fast suite after the build.",
    tierCommands: {
      minimal: ["npm run build"],
      recommended: ["npm run build", "npm run test:fast"],
      full: ["npm run build", "npm run test:fast", "npm test", "npm run smoke"],
    },
    tierRationales: {
      minimal: "Compile the changed backend surface and stop there.",
      recommended: "Validate the API code path with the fast test suite after the build.",
      full: "Use the full repo suite plus a smoke check before release or merge.",
    },
  },
  cli: {
    defaultTier: "recommended",
    notes: "CLI changes should validate the build, the fast suite, and runtime smoke paths.",
    tierCommands: {
      minimal: ["npm run build"],
      recommended: ["npm run build", "npm run test:fast", "npm run smoke"],
      full: ["npm run build", "npm run test:fast", "npm test", "npm run smoke"],
    },
    tierRationales: {
      minimal: "Build the CLI surface and verify the command wiring compiles.",
      recommended: "Check the CLI runtime path with the fast suite and smoke validation.",
      full: "Exercise the full test suite and smoke validation for command-line delivery.",
    },
  },
  dashboard: {
    defaultTier: "full",
    notes: "Dashboard work needs both the TypeScript build and the Vite/UI test pass.",
    tierCommands: {
      minimal: ["npm run build"],
      recommended: ["npm run build", "npm run build:ui", "npm run test:ui"],
      full: ["npm run build", "npm run build:ui", "npm run test:ui", "npm run test:fast", "npm test"],
    },
    tierRationales: {
      minimal: "Compile the dashboard surface only.",
      recommended: "Verify the dashboard build and dedicated UI tests.",
      full: "Run the dashboard build, UI tests, and repo-level verification before shipping.",
    },
  },
  track: {
    defaultTier: "recommended",
    notes: "Track work should include conductor rescan after the implementation lands.",
    tierCommands: {
      minimal: ["npm run build"],
      recommended: ["npm run build", "npm run test:fast", "node build/cli.js conductor rescan"],
      full: ["npm run build", "npm run test:fast", "npm test", "node build/cli.js conductor rescan", "python scripts/sync_foszal.py"],
    },
    tierRationales: {
      minimal: "Compile the tracked change set and stop before the conductor refresh.",
      recommended: "Verify the track with the fast suite and rescan conductor state.",
      full: "Use the repo-wide suite, conductor rescan, and session sync before closing the track.",
    },
  },
  docs: {
    defaultTier: "recommended",
    notes: "Docs and config changes should include the build and session sync step.",
    tierCommands: {
      minimal: ["npm run build"],
      recommended: ["npm run build", "npm run test:fast", "python scripts/sync_foszal.py"],
      full: ["npm run build", "npm run test:fast", "npm test", "python scripts/sync_foszal.py", "node build/cli.js conductor rescan"],
    },
    tierRationales: {
      minimal: "Compile the docs/config paths and inspect the generated artifacts.",
      recommended: "Run the fast suite plus the FOSZAL sync step used by docs work.",
      full: "Use the full suite together with session sync and conductor refresh.",
    },
  },
  mixed: {
    defaultTier: "full",
    notes: "Cross-cutting work usually spans backend, UI, and operational checks.",
    tierCommands: {
      minimal: ["npm run build"],
      recommended: ["npm run build", "npm run test:fast", "npm run build:ui", "npm run test:ui"],
      full: ["npm run build", "npm run test:fast", "npm test", "npm run build:ui", "npm run test:ui", "npm run smoke"],
    },
    tierRationales: {
      minimal: "Compile the shared surface only.",
      recommended: "Validate the backend and UI surfaces without the expensive smoke pass.",
      full: "Use the repo suite, UI tests, and smoke check for mixed-surface delivery.",
    },
  },
};

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getSurfaceProfile(surface: MissionSurface): SurfaceProfile {
  return surfaceProfiles[surface] || surfaceProfiles.api;
}

function toStatus(score: number): "healthy" | "warning" | "critical" {
  if (score >= 85) return "healthy";
  if (score >= 65) return "warning";
  return "critical";
}

function buildTiers(surface: MissionSurface): TestCadenceAdvice["tiers"] {
  const profile = getSurfaceProfile(surface);
  return testCadenceTierValues.map((tier) => ({
    tier,
    title: testCadenceTierLabels[tier],
    rationale: profile.tierRationales[tier],
    commands: dedupe(profile.tierCommands[tier]),
  }));
}

export function buildTestCadenceAdvice(options: {
  surface?: MissionSurface;
  tier?: TestCadenceTier;
}): TestCadenceAdvice {
  const surface = options.surface ?? "api";
  const profile = getSurfaceProfile(surface);
  const defaultTier = profile.defaultTier;
  const selectedTier = options.tier ?? defaultTier;
  const tiers = buildTiers(surface);
  const selectedCommands = tiers.find((tier) => tier.tier === selectedTier)?.commands ?? tiers[1].commands;

  const warnings: string[] = [];
  if (selectedTier === "minimal" && surface !== "docs") {
    warnings.push("Minimal cadence is best kept to docs-only or exploratory work.");
  }
  if (selectedTier !== defaultTier) {
    warnings.push(`Selected tier ${selectedTier} overrides the default ${defaultTier} cadence for ${missionSurfaceLabels[surface]}.`);
  }
  if ((surface === "dashboard" || surface === "mixed") && selectedTier !== "full") {
    warnings.push("Dashboard and mixed work usually need the full cadence.");
  }

  const score = clampScore(
    72 +
      selectedCommands.length * 6 +
      (selectedTier === defaultTier ? 8 : 0) -
      warnings.length * 8,
  );

  return {
    surface,
    defaultTier,
    selectedTier,
    score,
    status: toStatus(score),
    tiers,
    recommendedCommands: selectedCommands,
    warnings,
  };
}

export function renderTestPlanMarkdown(snapshot: DevExPlannerSnapshot): string {
  const { mission, testCadence, summary } = snapshot;

  const lines: string[] = [
    "# Test Cadence Advisor",
    "",
    `- Surface: ${missionSurfaceLabels[testCadence.surface]}`,
    `- Default tier: ${testCadenceTierLabels[testCadence.defaultTier]}`,
    `- Selected tier: ${testCadenceTierLabels[testCadence.selectedTier]}`,
    `- Score: ${summary.cadenceScore}/100 (${testCadence.status})`,
    "",
    "## Recommended commands",
  ];

  if (testCadence.recommendedCommands.length === 0) {
    lines.push("- None");
  } else {
    lines.push(...testCadence.recommendedCommands.map((command) => `- \`${command}\``));
  }

  lines.push("", "## Cadence tiers");
  for (const tier of testCadence.tiers) {
    lines.push(`### ${tier.title}`);
    lines.push(tier.rationale);
    if (tier.commands.length > 0) {
      lines.push("", "```bash", ...tier.commands, "```", "");
    } else {
      lines.push("");
    }
  }

  if (testCadence.warnings.length > 0) {
    lines.push("## Warnings");
    for (const warning of testCadence.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("## Mission context", `- Template: ${mission.title}`, `- Goal: ${mission.goal}`);
  return lines.join("\n").trim();
}
