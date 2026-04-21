import { LeadHunterSkill } from "./LeadHunterSkill.js";
import { FinanceReportSkill } from "./FinanceReportSkill.js";
import { ContentWriterSkill } from "./ContentWriterSkill.js";
import { MarketWatchSkill } from "./MarketWatchSkill.js";
import { WorkflowTriggerSkill } from "./WorkflowTriggerSkill.js";
import { NegotiationSkill } from "./NegotiationSkill.js";
import { StudioOrchestrationSkill } from "./StudioOrchestrationSkill.js";
import { RoughCutSkill } from "./RoughCutSkill.js";
import { AudioPostSkill } from "./AudioPostSkill.js";
import { DeliverySkill } from "./DeliverySkill.js";
import { matchesSkillName, normalizeSkillName } from "./skill-helpers.js";
import type { BrunellaSkill } from "./skill.interface.js";

export type SkillMetadata = Omit<BrunellaSkill, "execute" | "validate" | "getValidationResult">;

export const SKILL_REGISTRY: Record<string, BrunellaSkill> = {
  [normalizeSkillName(LeadHunterSkill.name)]: LeadHunterSkill,
  [normalizeSkillName(FinanceReportSkill.name)]: FinanceReportSkill,
  [normalizeSkillName(ContentWriterSkill.name)]: ContentWriterSkill,
  [normalizeSkillName(MarketWatchSkill.name)]: MarketWatchSkill,
  [normalizeSkillName(WorkflowTriggerSkill.name)]: WorkflowTriggerSkill,
  [normalizeSkillName(NegotiationSkill.name)]: NegotiationSkill,
  [normalizeSkillName(StudioOrchestrationSkill.name)]: StudioOrchestrationSkill,
  [normalizeSkillName(RoughCutSkill.name)]: RoughCutSkill,
  [normalizeSkillName(AudioPostSkill.name)]: AudioPostSkill,
  [normalizeSkillName(DeliverySkill.name)]: DeliverySkill,
};

export function getSkill(name: string): BrunellaSkill | undefined {
  const normalized = normalizeSkillName(name);
  const direct = SKILL_REGISTRY[normalized];
  if (direct) return direct;

  return Object.values(SKILL_REGISTRY).find((skill) =>
    matchesSkillName(skill.name, normalized),
  );
}

export function listSkills(): SkillMetadata[] {
  return Object.values(SKILL_REGISTRY)
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      version: skill.version,
      category: skill.category,
      tools: [...skill.tools],
      ...(skill.agents ? { agents: [...skill.agents] } : {}),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

