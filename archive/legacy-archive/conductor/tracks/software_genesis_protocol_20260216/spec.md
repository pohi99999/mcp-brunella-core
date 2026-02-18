# Technical Specification: Software Genesis Protocol

**Track ID:** `software_genesis_protocol_20260216`  
**Status:** `pending_approval`  
**Last Updated:** 2026-02-16  

---

## 📖 Context

Egy komplett „Alkalmazásgyár” (Software Genesis Protocol) létrehozása, ahol a BAS az ötlet tisztázásától az architektúra-tervezésen át a fejlesztésig, QA-ig és DevOps-ig autonóm, moduláris ügynök-squadokkal dolgozik.

---

## 🎯 Goals

- Interjú mód: követelmények tisztázása.
- Architektúra-tervezés (SystemBlueprint).
- SpecWriter feladatbontás (ModuleDefinition).
- Párhuzamos frontend/backend kivitelezés.
- QA és DevOps folyamat automatizálása.

---

## 🧱 Core Components

- `src/agents/OrchestratorAgent.ts` – Interview Mode bővítés
- `src/agents/ArchitectAgent.ts` – SystemBlueprint generálás
- `src/agents/UXDesignerAgent.ts` – UI/UX ügynök
- `src/agents/DeveloperAgent.ts` – Backend/logic
- `src/agents/EvaluatorAgent.ts` – QA
- `src/agents/DevOpsAgent.ts` – Deploy/config
- `src/workflows/GenesisWorkflow.ts` – állapotgép vezérlés

---

## 📦 Data Structures

```typescript
interface GenesisRequest {
  originalIdea: string;
  clarifiedSpecs: {
    platform: 'web' | 'mobile_react_native' | 'electron';
    coreFeatures: string[];
    uiStyle: 'modern' | 'minimalist' | 'corporate';
    backendType: 'firebase' | 'node_custom' | 'supabase';
    constraints: string[];
  };
  status: 'idea' | 'defining' | 'architecting' | 'coding' | 'testing' | 'deployed';
}

interface SystemBlueprint {
  techStack: {
    language: string;
    frameworks: string[];
    database: string;
    thirdPartyAPIs: string[];
  };
  architectureDiagram: string;
  fileStructure: string[];
  modules: ModuleDefinition[];
}

interface ModuleDefinition {
  id: string;
  type: 'backend' | 'frontend_ui' | 'logic';
  assignedAgent: 'Developer' | 'UXDesigner';
  dependencies: string[];
  prompt: string;
  acceptanceCriteria: string[];
}
```

---

## 🔄 Workflow

1. **Inception:** Orchestrator Interview Mode tisztázza a GenesisRequest-et.
2. **Architecture:** ArchitectAgent SystemBlueprintet készít.
3. **Task Engineering:** SpecWriterAgent modulokra bont.
4. **Production:** UXDesigner + Developer párhuzamosan dolgozik.
5. **QA:** EvaluatorAgent tesztel és visszadob.
6. **Delivery:** DevOpsAgent deploy, config, README.

---

## 🛡️ Critical Constraints

- **Shared types:** backend/frontend contract változásnál kötelező sync.
- **No `any`:** minden modul definíció typizált.
- **Loop prevention:** 3 QA retry után manuális beavatkozás.
- **Mock-first UI:** frontend ne várjon backend készültségre.

---

## ✅ Acceptance Criteria

- GenesisWorkflow sikeresen végigfut egy demo projekten.
- Modularizált tasklista készül SpecWriter outputból.
- `npm test` pass.

---

*Spec v1.0 | 2026-02-16*