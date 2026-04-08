import type {
  DocsConfigHealthStatus,
  DocsConfigSotSnapshot,
  SurfaceSummary,
} from "./docsConfigSot.js";

export interface DocsUnifierFinding {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  surfaces: string[];
}

export interface DocsUnifierRecommendation {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  rationale: string;
  actions: string[];
}

export interface DocsUnifierReport {
  checkedAt: string;
  summary: {
    requiredPresent: number;
    requiredTotal: number;
    managedHealthy: number;
    managedTotal: number;
    coveragePercent: number;
    managedCoveragePercent: number;
    score: number;
    status: DocsConfigHealthStatus;
  };
  canonicalDocs: SurfaceSummary[];
  managedDocs: SurfaceSummary[];
  scripts: SurfaceSummary[];
  missingCanonical: string[];
  missingManagedMarkers: string[];
  findings: DocsUnifierFinding[];
  recommendations: DocsUnifierRecommendation[];
}

function classifyStatus(score: number, hardFailure: boolean): DocsConfigHealthStatus {
  if (hardFailure) {
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

function scoreDocs(coveragePercent: number, managedCoveragePercent: number): number {
  return Math.max(0, Math.round((coveragePercent * 0.6) + (managedCoveragePercent * 0.4)));
}

export function buildDocsUnifierReport(snapshot: DocsConfigSotSnapshot): DocsUnifierReport {
  const canonicalDocs = snapshot.documents.surfaces.filter((surface) => surface.kind === "doc" && surface.required);
  const managedDocs = snapshot.documents.surfaces.filter((surface) => surface.kind === "doc" && surface.expectedMarkers.length > 0);
  const scripts = snapshot.documents.surfaces.filter((surface) => surface.kind === "script");

  const missingCanonical = canonicalDocs.filter((surface) => !surface.present).map((surface) => surface.name);
  const missingManagedMarkers = managedDocs
    .filter((surface) => surface.present && surface.matchedMarkers.length === 0)
    .map((surface) => surface.name);

  const score = scoreDocs(snapshot.documents.coveragePercent, snapshot.documents.managedCoveragePercent);
  const status = classifyStatus(score, missingCanonical.length > 0);

  const findings: DocsUnifierFinding[] = [
    ...missingCanonical.map((surface) => ({
      id: `missing:${surface.toLowerCase()}`,
      severity: "critical" as const,
      message: `Missing canonical documentation surface: ${surface}`,
      surfaces: [surface],
    })),
    ...missingManagedMarkers.map((surface) => ({
      id: `marker:${surface.toLowerCase()}`,
      severity: "medium" as const,
      message: `Managed doc marker missing from: ${surface}`,
      surfaces: [surface],
    })),
  ];

  const recommendations: DocsUnifierRecommendation[] = [];
  if (missingCanonical.length > 0) {
    recommendations.push({
      id: "restore-canonical-docs",
      priority: "critical",
      title: "Restore the canonical docs",
      rationale: "The source-of-truth document set is incomplete.",
      actions: [
        "Restore the missing canonical file(s).",
        "Re-run the docs sync workflow after the files are restored.",
      ],
    });
  }
  if (missingManagedMarkers.length > 0) {
    recommendations.push({
      id: "refresh-managed-docs",
      priority: "high",
      title: "Refresh managed documentation blocks",
      rationale: "One or more managed docs lost their generated marker block.",
      actions: [
        "Re-run the documentation sync workflow.",
        "Check the managed block markers in the generated files.",
      ],
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "docs-healthy",
      priority: "low",
      title: "Documentation sources are aligned",
      rationale: "The canonical documentation surfaces and managed blocks are intact.",
      actions: ["Keep the docs sync workflow in the regular maintenance loop."],
    });
  }

  return {
    checkedAt: snapshot.checkedAt,
    summary: {
      requiredPresent: snapshot.documents.presentRequiredCount,
      requiredTotal: snapshot.documents.requiredCount,
      managedHealthy: snapshot.documents.managedHealthyCount,
      managedTotal: snapshot.documents.managedCount,
      coveragePercent: snapshot.documents.coveragePercent,
      managedCoveragePercent: snapshot.documents.managedCoveragePercent,
      score,
      status,
    },
    canonicalDocs,
    managedDocs,
    scripts,
    missingCanonical,
    missingManagedMarkers,
    findings,
    recommendations,
  };
}

export function renderDocsUnifierMarkdown(report: DocsUnifierReport): string {
  const surfaceRows = report.canonicalDocs.map((surface) =>
    `| ${surface.name} | ${surface.present ? "present" : "missing"} | ${surface.matchedMarkers.join(", ") || "-"} |`,
  );

  return [
    "# Docs Unifier",
    "",
    `- Checked at: **${report.checkedAt}**`,
    `- Health: **${report.summary.status}** (${report.summary.score}/100)`,
    `- Canonical docs: **${report.summary.requiredPresent}/${report.summary.requiredTotal}**`,
    `- Managed docs: **${report.summary.managedHealthy}/${report.summary.managedTotal}**`,
    "",
    "## Canonical docs",
    "",
    "| Surface | State | Markers |",
    "| --- | --- | --- |",
    ...surfaceRows,
    "",
    "## Findings",
    "",
    report.findings.length === 0 ? "- None" : report.findings.map((finding) => `- ${finding.message}`).join("\n"),
    "",
    "## Recommendations",
    "",
    report.recommendations.map((item) => `- **${item.title}** — ${item.rationale}`).join("\n"),
  ].join("\n");
}

