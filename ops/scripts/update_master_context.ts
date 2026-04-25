
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocsConfigSotSnapshot } from '../../packages/utils/docsConfigSot.js';

// Paths
const ROOT_DIR = process.cwd();
const REGISTRY_PATH = path.join(ROOT_DIR, 'src/agents/registry.json');
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');
const MASTER_CONTEXT_PATH = path.join(ROOT_DIR, 'BRUNELLA_MASTER_CONTEXT.md');

// Interfaces
interface AgentDef {
  name: string;
  role: string;
  description?: string;
  capabilities?: string[];
  type?: string;
}

interface PackageJson {
  version: string;
  dependencies: Record<string, string>;
}

export async function updateMasterContext(dryRun = false) {
  console.log("🔄 Updating BRUNELLA_MASTER_CONTEXT.md...");

  try {
    // 1. Load Data
    const registryRaw = await fs.promises.readFile(REGISTRY_PATH, 'utf-8');
    const registryData = JSON.parse(registryRaw);
    const agents: AgentDef[] = Array.isArray(registryData) ? registryData : registryData.agents;

    const packageRaw = await fs.promises.readFile(PACKAGE_PATH, 'utf-8');
    const pkg: PackageJson = JSON.parse(packageRaw);
    const sotSnapshot = buildDocsConfigSotSnapshot(ROOT_DIR);

    // 2. Format Agent Table
    const coreAgents = agents.filter(a => ['orchestrator', 'agent_manager', 'evaluator', 'project_conductor'].includes(a.name.toLowerCase()) || (a.role && a.role.toLowerCase().includes('manager')));
    const executionAgents = agents.filter(a => !coreAgents.includes(a) && a.role && (a.role.toLowerCase().includes('developer') || a.role.toLowerCase().includes('researcher') || a.role.toLowerCase().includes('browser')));
    const businessAgents = agents.filter(a => !coreAgents.includes(a) && !executionAgents.includes(a));

    const formatAgentTable = (list: AgentDef[]) => {
      let table = "| Ügynök | Szerep | Képességek |\n| :--- | :--- | :--- |\n";
      list.forEach(a => {
        const caps = (a.capabilities || []).slice(0, 3).join(", ");
        table += `| **${a.name}** | ${a.role} | ${caps} |
`;
      });
      return table;
    };

    // 3. Construct Content
    const content = `# 🌌 BRUNELLA MASTER CONTEXT (Élő Rendszertérkép)

**Verzió:** ${pkg.version}
**Frissítve:** ${new Date().toISOString().split('T')[0]}
**Státusz:** ACTIVE (Élő rendszer)

---

## 1. 🏗️ Rendszer Áttekintés (The Big Picture)

A **Brunella Agent System (BAS)** egy hibrid, multi-agent AI ökoszisztéma, amelyet szoftverfejlesztés, kutatás és üzleti folyamatok automatizálására terveztek.

**Fő Jellemzők:**
*   **Hibrid Architektúra:** Node.js (Orchestration) + Python (AI/ML/Browser) + Cloudflare (Edge).
*   **Lokális + Felhő AI:** Ollama (Privát) + Gemini/OpenAI (Teljesítmény).
*   **Öngyógyító:** Phoenix Protocol v2 (Hiba detektálás és újraindítás).
*   **Memória:** SQLite (Feladatok) + LanceDB (Vektor/RAG) + AnythingLLM (Tudásbázis).
*   **Docs/config SOT:** ${sotSnapshot.summary.status} (${sotSnapshot.summary.score}/100, docs ${sotSnapshot.documents.presentRequiredCount}/${sotSnapshot.documents.requiredCount}, config ${sotSnapshot.config.docsKeyCoveragePercent}% / ${sotSnapshot.config.exampleKeyCoveragePercent}%).

---

## 2. 🤖 Az Ügynök Sereg (The Legion)

A rendszer **${agents.length}** regisztrált ügynökkel rendelkezik.

### 👑 Vezérkar (Core Leadership)
${formatAgentTable(coreAgents)}

### 🛠️ Végrehajtók (Execution Team)
${formatAgentTable(executionAgents)}

### 🏢 Üzleti és Egyéb Ügynökök
${formatAgentTable(businessAgents)}

---

## 3. ⚙️ Technológiai Stack (The Engine)

### Backend (Core)
*   **Runtime:** Node.js (TypeScript)
*   **Server:** Express.js + Socket.IO
*   **Port:** 3000

### Python Subsystem (Intelligence)
*   **Server:** FastAPI
*   **Port:** 8010 (Health), 8000 (API)
*   **Libs:** Pandas, Playwright, LanceDB

### AI Models
*   **Local:** Ollama (llama3.1:8b)
*   **Cloud:** Gemini 2.0 Flash, GPT-4o

---

## 4. 🖥️ Interfészek

*   **Mission Control Dashboard:** http://localhost:5173
*   **Brunella CLI:** 

---

**Ez a dokumentum automatikusan generált. Ne szerkeszd kézzel!**
*Script: ops/scripts/update_master_context.ts*

`;

    // 4. Write File
    const existing = fs.existsSync(MASTER_CONTEXT_PATH) ? await fs.promises.readFile(MASTER_CONTEXT_PATH, 'utf-8') : '';
    const changed = existing !== content;

    if (!dryRun && changed) {
      await fs.promises.writeFile(MASTER_CONTEXT_PATH, content, 'utf-8');
    }
    console.log("✅ BRUNELLA_MASTER_CONTEXT.md updated successfully!");
    return { changed, content };

  } catch (error) {
    console.error("❌ Error updating master context:", error);
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  void updateMasterContext();
}
