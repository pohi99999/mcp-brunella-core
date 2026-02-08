# Mission Control Dashboard 2.1 – Specifikáció

**Track ID:** `mission_control_dashboard_2_1_20260203`  
**Dátum:** 2026-02-03  
**Státusz:** ✅ Lezárva

---

## Cél

A Mission Control Dashboard továbbfejlesztése: interaktív ügynök kezelés, Orchestrator chat, beágyazott szolgáltatások (n8n, Langflow), beállítások panel, robusztus API hibakezelés.

---

## Implementált funkciók

### 1. Interaktív ügynök kártyák
- **AgentStatusCard.tsx** – Kattintható, expandable
- Részletek: capabilities (badge), priority, autoStart, triggers
- Gyors futtatás: feladat input + Play gomb → `executeAgent(agentName, task)`
- Adatforrás: GET /api/registry + socket status merge

### 2. Orchestrator chat (Neural Link)
- **NeuralLinkChat.tsx** – Módváltó: Orchestrator (alapértelmezett) | Ollama
- Orchestrator: `executeAgent("Orchestrator", message)`
- Ollama: közvetlen `generateWithOllama()`, modellválasztó

### 3. Beágyazott szolgáltatások
- **EmbeddedWorkflow.tsx** – n8n (5678), Langflow (7860) iframe
- Sidebar: n8n, Langflow tabok
- URL: VITE_N8N_URL, VITE_LANGFLOW_URL

### 4. Beállítások panel
- **SettingsPanel.tsx** – ServiceControlWidget, gyors parancsok

### 5. API hibakezelés
- **apiService.ts** – safeJson(), encodeURIComponent
- Üres/érvénytelen válasz kezelés

### 6. Backend
- GET /api/registry
- AgentManager.getRegistry()

---

## Érintett fájlok

| Fájl | Változás |
|------|----------|
| `src/dashboard/components/dashboard/AgentStatusCard.tsx` | Expand, capabilities, onExecute |
| `src/dashboard/components/dashboard/NeuralLinkChat.tsx` | Orchestrator/Ollama mód |
| `src/dashboard/components/dashboard/EmbeddedWorkflow.tsx` | Új – iframe |
| `src/dashboard/components/dashboard/SettingsPanel.tsx` | Új |
| `src/dashboard/components/dashboard/MissionControlLayout.tsx` | Registry, tabok, handleExecuteAgent |
| `src/dashboard/lib/apiService.ts` | safeJson, minden hívás |
| `src/agents/AgentManager.ts` | getRegistry() |
| `src/server/web.ts` | GET /api/registry |
