import type {
  DocsConfigHealthStatus,
  DocsConfigSotSnapshot,
  ConfigKeyCoverage,
} from "./docsConfigSot.js";

export interface ConfigGuardianFinding {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  keys: string[];
}

export interface ConfigGuardianRecommendation {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  rationale: string;
  actions: string[];
}

export interface ConfigGuardianReport {
  checkedAt: string;
  summary: {
    runtimeKeys: number;
    docsCoveragePercent: number;
    exampleCoveragePercent: number;
    score: number;
    status: DocsConfigHealthStatus;
  };
  missingFromDocs: ConfigKeyCoverage[];
  missingFromExample: ConfigKeyCoverage[];
  yamlBindingsMissingFromRuntime: string[];
  findings: ConfigGuardianFinding[];
  recommendations: ConfigGuardianRecommendation[];
}

function classifyStatus(score: number, criticalIssues: number): DocsConfigHealthStatus {
  if (criticalIssues > 0) {
    return "critical";
  }
  if (score >= 85) {
    return "healthy";
  }
  if (score >= 65) {
    return "warning";
  }
  return "critical";
}

function scoreConfig(docsCoveragePercent: number, exampleCoveragePercent: number, missingYamlBindings: number): number {
  const base = Math.round((docsCoveragePercent + exampleCoveragePercent) / 2);
  return Math.max(0, base - Math.min(25, missingYamlBindings * 8));
}

function severityForCount(count: number): "low" | "medium" | "high" | "critical" {
  if (count >= 5) {
    return "high";
  }
  if (count >= 2) {
    return "medium";
  }
  return "low";
}

export function buildConfigGuardianReport(snapshot: DocsConfigSotSnapshot): ConfigGuardianReport {
  const missingFromDocs = snapshot.config.missingFromDocs;
  const missingFromExample = snapshot.config.missingFromExample;
  const yamlBindingsMissingFromRuntime = snapshot.config.yamlBindingsMissingFromRuntime;

  const findings: ConfigGuardianFinding[] = [
    ...(missingFromDocs.length > 0
      ? [
          {
            id: "docs-gap",
            severity: severityForCount(missingFromDocs.length),
            message: "Some runtime env keys are not documented in the canonical doc set.",
            keys: missingFromDocs.map((entry) => entry.key),
          },
        ]
      : []),
    ...(missingFromExample.length > 0
      ? [
          {
            id: "example-gap",
            severity: severityForCount(missingFromExample.length),
            message: "Some runtime env keys are not represented in .env.example.",
            keys: missingFromExample.map((entry) => entry.key),
          },
        ]
      : []),
    ...(yamlBindingsMissingFromRuntime.length > 0
      ? [
          {
            id: "yaml-runtime-gap",
            severity: "high" as const,
            message: "Some PAIOS YAML bindings do not resolve to runtime env keys.",
            keys: yamlBindingsMissingFromRuntime,
          },
        ]
      : []),
  ];

  const score = scoreConfig(
    snapshot.config.docsKeyCoveragePercent,
    snapshot.config.exampleKeyCoveragePercent,
    yamlBindingsMissingFromRuntime.length,
  );
  const criticalIssues = yamlBindingsMissingFromRuntime.length + (missingFromDocs.length === 0 ? 0 : 1);
  const status = classifyStatus(score, criticalIssues);

  const recommendations: ConfigGuardianRecommendation[] = [];
  if (missingFromDocs.length > 0) {
    recommendations.push({
      id: "close-docs-gap",
      priority: "high",
      title: "Document the missing runtime env keys",
      rationale: "Runtime configuration is ahead of the canonical documentation.",
      actions: [
        "Add the missing keys to the canonical docs or generated docs blocks.",
        "Re-run the docs/config sync workflow after the docs are updated.",
      ],
    });
  }
  if (missingFromExample.length > 0) {
    recommendations.push({
      id: "close-example-gap",
      priority: "medium",
      title: "Extend .env.example",
      rationale: "The example environment file is missing runtime keys.",
      actions: [
        "Add the missing keys to .env.example.",
        "Keep placeholder values aligned with the runtime naming.",
      ],
    });
  }
  if (yamlBindingsMissingFromRuntime.length > 0) {
    recommendations.push({
      id: "close-yaml-gap",
      priority: "critical",
      title: "Resolve PAIOS YAML binding drift",
      rationale: "The YAML config refers to environment variables that the runtime does not currently advertise.",
      actions: [
        "Verify the environment key name in paios.config.yaml.",
        "Update the runtime config surface or the YAML binding so the names match.",
      ],
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "config-healthy",
      priority: "low",
      title: "Configuration sources are aligned",
      rationale: "The runtime config and the documented example/config bindings are in sync.",
      actions: ["Keep the unified sync workflow on the regular maintenance path."],
    });
  }

  return {
    checkedAt: snapshot.checkedAt,
    summary: {
      runtimeKeys: snapshot.config.runtimeKeys.length,
      docsCoveragePercent: snapshot.config.docsKeyCoveragePercent,
      exampleCoveragePercent: snapshot.config.exampleKeyCoveragePercent,
      score,
      status,
    },
    missingFromDocs,
    missingFromExample,
    yamlBindingsMissingFromRuntime,
    findings,
    recommendations,
  };
}

export function renderConfigGuardianMarkdown(report: ConfigGuardianReport): string {
  const missingDocRows = report.missingFromDocs.map(
    (entry) => `| ${entry.key} | ${entry.sources.join(", ") || "-"} |`,
  );
  const missingExampleRows = report.missingFromExample.map(
    (entry) => `| ${entry.key} | ${entry.sources.join(", ") || "-"} |`,
  );

  return [
    "# Config Guardian",
    "",
    `- Checked at: **${report.checkedAt}**`,
    `- Health: **${report.summary.status}** (${report.summary.score}/100)`,
    `- Runtime keys: **${report.summary.runtimeKeys}**`,
    `- Docs coverage: **${report.summary.docsCoveragePercent}%**`,
    `- Example coverage: **${report.summary.exampleCoveragePercent}%**`,
    "",
    "## Missing from docs",
    "",
    "| Key | Sources |",
    "| --- | --- |",
    ...(missingDocRows.length > 0 ? missingDocRows : ["| - | - |"]),
    "",
    "## Missing from .env.example",
    "",
    "| Key | Sources |",
    "| --- | --- |",
    ...(missingExampleRows.length > 0 ? missingExampleRows : ["| - | - |"]),
    "",
    "## YAML bindings missing from runtime",
    "",
    report.yamlBindingsMissingFromRuntime.length > 0
      ? report.yamlBindingsMissingFromRuntime.map((key) => `- ${key}`).join("\n")
      : "- None",
    "",
    "## Recommendations",
    "",
    report.recommendations.map((item) => `- **${item.title}** — ${item.rationale}`).join("\n"),
  ].join("\n");
}

