# Conductor Manifest

**Verzió:** 2.1.0
**Utolsó frissítés:** 2026-02-04
**Karbantartó:** ProjectConductorAgent

---

## Projekt Áttekintés

A Brunella Agent System (BAS) egy AI multi-agent rendszer, amely automatizálja a szoftverfejlesztést lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

---

## Aktív Komponensek

| Komponens | Státusz | Leírás |
|-----------|---------|--------|
| **OrchestratorAgent** | ✅ Működik | Központi tervező és delegáló |
| **ProjectConductorAgent** | 🟡 80% | Dokumentáció és track koordináció |
| **EdgeProxyAgent** | ✅ Működik | Cloudflare Edge kommunikáció |
| **Mission Control Dashboard** | ✅ v2.1 | React UI Socket.IO-val |
| **LLM Client** | ✅ Működik | Multi-provider (Ollama/Gemini) |
| **RAG System** | ✅ v2.0 | Vector embeddings LanceDB-vel |

---

## Aktív Fejlesztési Szálak

Lásd: [tracks.md](./tracks.md)

| Track | Prioritás | Progress |
|-------|-----------|----------|
| Cloudflare Edge Integration | HIGH | 65% |
| ProjectConductor Agent | HIGH | 80% |
| BAS Scale-Up & Stabilization | MEDIUM | 90% |
| Robotkéz n8n Sandbox | MEDIUM | 70% |

---

## Legutóbbi Változások

### 2026-02-04
- Agent interfész konzisztencia javítás (IAgent vs BaseAgent)
- LLM client hardening (timeout, Content-Type, HTTP status)
- Dashboard iframe security fix
- RAG vector embeddings implementálás
- GitHub workflow SQL injection védelem
- Socket.IO error handlers
- Copilot és Jules instrukciók létrehozása

### 2026-02-03
- Mission Control Dashboard 2.1
- BAS Cloudflare Orchestrator deploy
- Hybrid Cloud Integration (R2, D1)

### 2026-02-02
- Mission Control Remote Access (Cloudflare Tunnel)
- Jules Self-Heal workflow
- LangSmith Python tracing

---

## Dokumentációs Hierarchia

```
conductor/
├── CONDUCTOR_MANIFEST.md  # Ez a fájl - projekt összefoglaló
├── tracks.md              # Központi track regiszter
├── SUMMARY.md             # Auto-generált összefoglaló
├── workflow.md            # Fejlesztési protokollok
├── tracks/                # Részletes track dokumentumok
└── archive/               # Archivált dokumentumok
```

---

## Kapcsolódó Fájlok

| Fájl | Tartalom |
|------|----------|
| `CLAUDE.md` | Claude Code instrukciók |
| `Brunella.md` | Teljes projekt dokumentáció |
| `_COPILOT_NEXT_TASKS.md` | Copilot CLI folytatási feladatok |
| `_JULES_MAINTENANCE_TASKS.md` | Jules karbantartási feladatok |

---

## Archívum

A régebbi AI session jegyzeteket és részletes fejlesztési naplókat lásd:
- `conductor/archive/CONDUCTOR_MANIFEST_backup_20260204.md`

---

*Automatikusan frissítve a ProjectConductorAgent által*
