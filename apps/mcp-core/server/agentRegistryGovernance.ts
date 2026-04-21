import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { agentManager } from "@packages/agents/AgentManager.js";
import type { RegistryConfig } from "@packages/agents/registryStandard.js";
import { auditAgentRegistry, type AgentRegistryAuditReport, type GovernanceDocumentInput } from "@packages/utils/agentRegistryAudit.js";
import { generateAgentRegistryRecommendations, type AgentRegistryRecommendation } from "@packages/utils/agentRegistryRecommendations.js";

export interface AgentRegistryGovernanceDocumentSummary {
  name: string;
  path: string;
  present: boolean;
  characters: number;
}

export interface AgentRegistryGovernanceSnapshot {
  checkedAt: string;
  registry: RegistryConfig;
  diagnostics: ReturnType<typeof agentManager.getAgentDiagnostics>;
  governanceDocuments: AgentRegistryGovernanceDocumentSummary[];
  audit: AgentRegistryAuditReport;
  recommendations: AgentRegistryRecommendation[];
}

interface GovernanceDocumentSource {
  name: string;
  path: string;
}

const GOVERNANCE_DOCUMENTS: GovernanceDocumentSource[] = [
  { name: "BRUNELLA_MASTER_CONTEXT.md", path: "BRUNELLA_MASTER_CONTEXT.md" },
  { name: "RENDSZER.md", path: "RENDSZER.md" },
];

function loadGovernanceDocument(source: GovernanceDocumentSource): {
  summary: AgentRegistryGovernanceDocumentSummary;
  input?: GovernanceDocumentInput;
} {
  const absolutePath = join(process.cwd(), source.path);
  if (!existsSync(absolutePath)) {
    return {
      summary: {
        name: source.name,
        path: absolutePath,
        present: false,
        characters: 0,
      },
    };
  }

  const content = readFileSync(absolutePath, "utf-8");
  return {
    summary: {
      name: source.name,
      path: absolutePath,
      present: true,
      characters: content.length,
    },
    input: {
      name: source.name,
      path: absolutePath,
      content,
    },
  };
}

export async function buildAgentRegistryGovernanceSnapshot(): Promise<AgentRegistryGovernanceSnapshot> {
  await agentManager.initialize();

  const checkedAt = new Date().toISOString();
  const registry = agentManager.getRegistry();
  const diagnostics = agentManager.getAgentDiagnostics();
  const documentLoads = GOVERNANCE_DOCUMENTS.map(loadGovernanceDocument);
  const governanceDocuments = documentLoads.map((entry) => entry.summary);
  const documentInputs = documentLoads.flatMap((entry) => (entry.input ? [entry.input] : []));

  const audit = auditAgentRegistry(registry, diagnostics, documentInputs, checkedAt);
  const recommendations = generateAgentRegistryRecommendations(audit);

  return {
    checkedAt,
    registry,
    diagnostics,
    governanceDocuments,
    audit,
    recommendations,
  };
}


