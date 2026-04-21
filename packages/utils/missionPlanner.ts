import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { load as loadYaml } from "js-yaml";
import { z } from "zod";

import {
  isMissionSurface,
  missionSurfaceLabels,
  type DevExPlannerMission,
  type DevExPlannerSnapshot,
  type DevExPlannerSummary,
  type DevExRecommendation,
  type MissionSurface,
  type MissionTemplate,
  type TestCadenceAdvice,
  type TestCadenceTier,
} from "./devExTypes.js";
import { buildTestCadenceAdvice, renderTestPlanMarkdown } from "./testCadenceAdvisor.js";

const missionTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  goal: z.string().min(1),
  surface: z.string().refine((value) => isMissionSurface(value), { message: "Invalid mission surface" }),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  steps: z.array(z.string().min(1)).min(1),
  commands: z.array(z.string().min(1)).default([]),
  artifacts: z.array(z.string().min(1)).default([]),
  trackRefs: z.array(z.string().min(1)).default([]),
});

type MissionTemplateInput = z.infer<typeof missionTemplateSchema>;

export interface MissionPlannerQuery {
  templateId?: string;
  surface?: MissionSurface;
  tier?: TestCadenceTier;
}

function getMissionTemplatesDir(rootDir: string): string {
  return join(rootDir, "missions");
}

function getLegacyMissionTemplatesDir(rootDir: string): string {
  return join(rootDir, "conductor", "legacy-root", "missions");
}

function normalizeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function normalizeTemplate(input: MissionTemplateInput): MissionTemplate {
  return {
    id: input.id.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    goal: input.goal.trim(),
    surface: input.surface as MissionSurface,
    category: input.category.trim(),
    tags: normalizeStrings(input.tags),
    steps: normalizeStrings(input.steps),
    commands: normalizeStrings(input.commands),
    artifacts: normalizeStrings(input.artifacts),
    trackRefs: normalizeStrings(input.trackRefs),
  };
}

export function loadMissionTemplates(rootDir: string = process.cwd()): MissionTemplate[] {
  const templateDir = getMissionTemplatesDir(rootDir);
  const legacyTemplateDir = getLegacyMissionTemplatesDir(rootDir);
  const resolvedTemplateDir = existsSync(templateDir) ? templateDir : legacyTemplateDir;

  if (!existsSync(resolvedTemplateDir)) {
    throw new Error(`Mission templates directory not found: ${templateDir}`);
  }

  const files = readdirSync(resolvedTemplateDir)
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error(`No mission template files found in ${templateDir}`);
  }

  const templates = files.map((file) => {
    const filePath = join(resolvedTemplateDir, file);
    const raw = loadYaml(readFileSync(filePath, "utf8"));
    const parsed = missionTemplateSchema.parse(raw);
    return normalizeTemplate(parsed);
  });

  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id)) {
      throw new Error(`Duplicate mission template id detected: ${template.id}`);
    }
    ids.add(template.id);
  }

  return templates.sort((left, right) => {
    const categoryCompare = left.category.localeCompare(right.category);
    if (categoryCompare !== 0) return categoryCompare;
    return left.title.localeCompare(right.title);
  });
}

function resolveSelectedTemplate(templates: MissionTemplate[], templateId?: string): MissionTemplate {
  if (!templateId) {
    return templates[0];
  }

  const selected = templates.find((template) => template.id === templateId);
  if (!selected) {
    throw new Error(`Unknown mission template: ${templateId}`);
  }

  return selected;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toStatus(score: number): "healthy" | "warning" | "critical" {
  if (score >= 85) return "healthy";
  if (score >= 65) return "warning";
  return "critical";
}

function buildMissionScore(template: MissionTemplate): number {
  return clampScore(
    45 +
      template.steps.length * 8 +
      template.commands.length * 5 +
      template.artifacts.length * 4 +
      template.trackRefs.length * 3 +
      template.tags.length * 2,
  );
}

function buildMissionWarnings(
  template: MissionTemplate,
  cadence: TestCadenceAdvice,
  effectiveSurface: MissionSurface,
): string[] {
  const warnings: string[] = [];

  if (template.steps.length < 4) {
    warnings.push(`Mission template ${template.id} has fewer than four steps.`);
  }
  if (template.commands.length < 2) {
    warnings.push(`Mission template ${template.id} has a very small command set.`);
  }
  if (template.artifacts.length === 0) {
    warnings.push(`Mission template ${template.id} does not declare expected artifacts.`);
  }
  if (template.trackRefs.length === 0) {
    warnings.push(`Mission template ${template.id} is not linked to any track references.`);
  }
  if (template.surface !== effectiveSurface) {
    warnings.push(`The selected surface ${missionSurfaceLabels[effectiveSurface]} overrides the template's default ${missionSurfaceLabels[template.surface]}.`);
  }

  for (const warning of cadence.warnings) {
    warnings.push(warning);
  }

  return Array.from(new Set(warnings));
}

function buildRecommendations(
  template: MissionTemplate,
  cadence: TestCadenceAdvice,
  effectiveSurface: MissionSurface,
): DevExRecommendation[] {
  const recommendations: DevExRecommendation[] = [];

  if (template.steps.length < 4) {
    recommendations.push({
      id: `${template.id}-expand-steps`,
      target: "mission",
      priority: "high",
      title: "Expand the mission into a fuller step sequence",
      rationale: "Short mission templates make the execution path too ambiguous.",
      evidence: [`steps=${template.steps.length}`],
      actions: [
        "Split the mission into concrete implementation, wiring, and validation steps.",
        "Add a final verification step that matches the selected surface.",
      ],
    });
  }

  if (template.commands.length < 2) {
    recommendations.push({
      id: `${template.id}-add-commands`,
      target: "mission",
      priority: "medium",
      title: "Add explicit mission commands",
      rationale: "Mission templates should show the operator the first useful commands up front.",
      evidence: [`commands=${template.commands.length}`],
      actions: [
        "Include the build command.",
        "Include the first validation or smoke command for the surface.",
      ],
    });
  }

  if (template.artifacts.length === 0) {
    recommendations.push({
      id: `${template.id}-declare-artifacts`,
      target: "combined",
      priority: "medium",
      title: "Declare the expected mission artifacts",
      rationale: "Without artifacts the planner cannot communicate what should exist after the work lands.",
      evidence: ["artifacts=0"],
      actions: ["List the concrete files or outputs the mission should produce."],
    });
  }

  if (template.trackRefs.length === 0) {
    recommendations.push({
      id: `${template.id}-link-tracks`,
      target: "mission",
      priority: "low",
      title: "Link the template to related track references",
      rationale: "Track references help operators reuse the right track history quickly.",
      evidence: ["trackRefs=0"],
      actions: ["Add the related conductor track ids or file references to the template."],
    });
  }

  if (template.surface !== effectiveSurface) {
    recommendations.push({
      id: `${template.id}-surface-override`,
      target: "cadence",
      priority: "low",
      title: "Document the surface override explicitly",
      rationale: "The selected surface should be obvious when it differs from the template default.",
      evidence: [`templateSurface=${template.surface}`, `selectedSurface=${effectiveSurface}`],
      actions: ["Mention the override in the run note or mission output."],
    });
  }

  if (cadence.selectedTier !== cadence.defaultTier) {
    recommendations.push({
      id: `${template.id}-cadence-context`,
      target: "combined",
      priority: "low",
      title: "Carry the cadence rationale into the task note",
      rationale: "The chosen tier should be visible when a user revisits the mission.",
      evidence: [`tier=${cadence.selectedTier}`, `defaultTier=${cadence.defaultTier}`],
      actions: ["Record why the cadence differs from the default profile, if it does."],
    });
  }

  return recommendations;
}

function buildSummary(
  template: MissionTemplate,
  cadence: TestCadenceAdvice,
  warnings: string[],
  templateCount: number,
): DevExPlannerSummary {
  const missionScore = buildMissionScore(template);
  const cadenceScore = cadence.score;
  const overall = clampScore(Math.round((missionScore + cadenceScore) / 2) - Math.min(15, warnings.length * 3));

  return {
    score: overall,
    status: toStatus(overall),
    missionScore,
    cadenceScore,
    templateCount,
    selectedSurface: cadence.surface,
    selectedTemplateId: template.id,
  };
}

export function buildDevExPlannerSnapshot(query: MissionPlannerQuery = {}): DevExPlannerSnapshot {
  const templates = loadMissionTemplates();
  const selectedTemplate = resolveSelectedTemplate(templates, query.templateId);
  const effectiveSurface = query.surface ?? selectedTemplate.surface;
  const cadence = buildTestCadenceAdvice({
    surface: effectiveSurface,
    tier: query.tier,
  });

  const warnings = buildMissionWarnings(selectedTemplate, cadence, effectiveSurface);
  const recommendations = buildRecommendations(
    selectedTemplate,
    cadence,
    effectiveSurface,
  );

  const summary = buildSummary(selectedTemplate, cadence, warnings, templates.length);

  return {
    checkedAt: new Date().toISOString(),
    templates,
    selectedTemplate,
    mission: {
      templateId: selectedTemplate.id,
      title: selectedTemplate.title,
      description: selectedTemplate.description,
      goal: selectedTemplate.goal,
      surface: selectedTemplate.surface,
      category: selectedTemplate.category,
      tags: selectedTemplate.tags,
      steps: selectedTemplate.steps,
      commands: selectedTemplate.commands,
      artifacts: selectedTemplate.artifacts,
      trackRefs: selectedTemplate.trackRefs,
    },
    testCadence: cadence,
    summary,
    warnings,
    recommendations,
  };
}

function renderTemplateList(templates: MissionTemplate[]): string[] {
  const lines: string[] = [];
  for (const template of templates) {
    lines.push(`- **${template.title}** (\`${template.id}\`) — ${missionSurfaceLabels[template.surface]} · ${template.category}`);
  }
  return lines;
}

function renderCodeBlock(lines: string[]): string {
  if (lines.length === 0) {
    return "```text\n(none)\n```";
  }

  return ["```bash", ...lines, "```"].join("\n");
}

export function renderMissionMarkdown(snapshot: DevExPlannerSnapshot): string {
  const { mission, summary, templates, selectedTemplate } = snapshot;

  const lines: string[] = [
    "# Mission Planner",
    "",
    `- Checked at: ${snapshot.checkedAt}`,
    `- Selected template: ${selectedTemplate.title} (\`${selectedTemplate.id}\`)`,
    `- Surface: ${missionSurfaceLabels[summary.selectedSurface]}`,
    `- Score: ${summary.missionScore}/100`,
    `- Overall: ${summary.score}/100 (${summary.status})`,
    `- Template library: ${summary.templateCount}`,
    "",
    "## Goal",
    mission.goal,
    "",
    "## Steps",
  ];

  mission.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });

  lines.push("", "## Commands", renderCodeBlock(mission.commands));

  if (mission.artifacts.length > 0) {
    lines.push("", "## Artifacts");
    mission.artifacts.forEach((artifact) => {
      lines.push(`- \`${artifact}\``);
    });
  }

  if (mission.trackRefs.length > 0) {
    lines.push("", "## Related tracks");
    mission.trackRefs.forEach((trackRef) => {
      lines.push(`- \`${trackRef}\``);
    });
  }

  if (snapshot.recommendations.length > 0) {
    lines.push("", "## Recommendations");
    snapshot.recommendations
      .filter((recommendation) => recommendation.target !== "cadence")
      .forEach((recommendation) => {
        lines.push(`### ${recommendation.title}`);
        lines.push(`${recommendation.rationale}`);
        if (recommendation.evidence.length > 0) {
          lines.push("", `Evidence: ${recommendation.evidence.join(", ")}`);
        }
        if (recommendation.actions.length > 0) {
          lines.push(...recommendation.actions.map((action) => `- ${action}`));
        }
        lines.push("");
      });
  }

  lines.push("", "## Template library");
  lines.push(...renderTemplateList(templates));

  return lines.join("\n").trim();
}

export function renderDevExPlannerMarkdown(snapshot: DevExPlannerSnapshot): string {
  return [
    renderMissionMarkdown(snapshot),
    renderTestPlanMarkdown(snapshot),
  ].join("\n\n");
}

