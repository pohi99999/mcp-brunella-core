# 🎮 Conductor (Project Management) - SUMMARY

**Utolsó frissítés:** 2026-02-03
**Generátor:** ProjectConductorAgent

Ez a mappa tartalmazza a Brunella projekt specifikáció-vezérelt fejlesztési keretrendszerének dokumentációit.

---

## 🗂️ Struktúra

```
conductor/
├── SUMMARY.md            # Ez a fájl - Összefoglaló
├── tracks.md             # Központi track regiszter
├── workflow.md           # Fejlesztési folyamat és protokollok
├── tech-stack.md         # Technológiai stack definíció
├── product.md            # Termék jövőképe és funkciók
├── product-guidelines.md # Stílus és minőségi irányelvek
├── project_state.json    # Projekt állapot (auto-generated)
│
├── tracks/               # Aktív és korábbi fejlesztési sávok
│   ├── cloudflare_edge_integration_20260202/
│   ├── project_conductor_agent_20260202/
│   ├── bas_scale_up_stabilization_20260131/
│   └── ...
│
└── archive/              # Lezárt és archivált sávok
```

---

## Jelenlegi Állapot

| Metrika | Érték |
|---------|-------|
| **Aktív track-ek** | 9 |
| **Lezárt track-ek** | 4 |
| **Archivált track-ek** | 25 |
| **Egészségi állapot** | Healthy |
| **Utolsó szinkron** | 2026-02-05 |

---

## Aktív Track-ek

### HIGH Priority

1. **Cloudflare Edge Integration**
   - Edge orchestrátor Cloudflare Workers-szel
   - [Plan](./tracks/cloudflare_edge_integration_20260202/plan.md)

2. **Hybrid Cloud Integration**
   - Cloudflare + lokális hibrid architektúra
   - [Plan](./tracks/hybrid_cloud_integration_20260203/plan.md)

3. **Data Flywheel Incubator**
   - Automatikus fine-tuning pipeline
   - [Plan](./tracks/data_flywheel_incubator_20260205/plan.md)

### MEDIUM Priority

4. **Browser-Use Harvester**
   - Strukturált JSON adat kinyerés Playwright-tel
   - [Plan](./tracks/browser_use_harvester_20260131/plan.md)

5. **LangSmith Integration**
   - Tracing és observability
   - [Plan](./tracks/langsmith_integration_20260130/plan.md)

6. **Robotkéz n8n Sandbox**
   - Browser-use + n8n automatizálás
   - [Spec](./tracks/robotkez_n8n_sandbox_edzesterv/spec.md)

7. **EV Hunter AI Research**
   - Kutatási pipeline
   - [Plan](./tracks/ev_hunter_ai_research_20260202/plan.md)

8. **Agent Architect Upgrade**
   - Meta-ügynök fejlesztés
   - [Plan](./tracks/agent_architect_upgrade_20260205/plan.md)

9. **Phoenix Protocol V2**
   - Öngyógyító rendszer
   - [Plan](./tracks/phoenix_protocol_v2_20260205/plan.md)

---

## 🛠️ Kulcsfájlok

| Fájl | Célja | Auto-Update |
|------|-------|-------------|
| `product.md` | Termék jövőképe és funkciók | ❌ |
| `tech-stack.md` | Technológiai stack definíció | ❌ |
| `workflow.md` | Fejlesztési folyamat és protokollok | ❌ |
| `tracks.md` | Központi track regiszter | ✅ |
| `SUMMARY.md` | Összefoglaló | ✅ |
| `project_state.json` | Állapot tárolás | ✅ |

---

## 🔄 Szinkronizálás

A dokumentáció automatikus szinkronizálásához:

```bash
# Teljes szinkron
brunella agent ProjectConductor "full"

# Csak dokumentáció
brunella agent ProjectConductor "sync"

# Projekt státusz
brunella agent ProjectConductor "status"
```

---

## 📋 Track Létrehozás

Új fejlesztési szál indításához:

```bash
# CLI-vel
brunella agent ProjectConductor "track create MyNewFeature"

# Manuálisan
# 1. Hozz létre mappát: conductor/tracks/myfeature_YYYYMMDD/
# 2. Hozz létre plan.md fájlt a sablonnal
# 3. Futtasd: brunella agent ProjectConductor "track update"
```

---

## 🔗 Kapcsolódó Dokumentumok

- [BRUNELLA.md](../Brunella.md) - Fő projekt README
- [konyvtarfa.md](../konyvtarfa.md) - Könyvtárstruktúra
- [CONDUCTOR_MANIFEST.md](../CONDUCTOR_MANIFEST.md) - Mission Control UI

---

*Generálta: ProjectConductorAgent*
*Verzió: 2.1.0*
