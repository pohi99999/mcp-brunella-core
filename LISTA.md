# LISTA – BAS Gyors Puska (Dashboard + Funkciók + Bekötöttség)

Frissítve: 2026-02-21

> Cél: 1 helyen legyen, mit hogyan érdemes használni, és mi van ténylegesen bekötve.

---

## 1) Gyors döntési tábla – „Mit akarok csinálni?”

- **Magyar nyelven feladatot kiosztani** → `brunella task "..."` vagy Dashboard **Neural Command** widget
- **Cloudflare worker állapot/audit** → `brunella edge audit` vagy Dashboard **Cloudflare Workers Audit** widget
- **Konkrét workerre feladatot küldeni** → `brunella edge submit-worker <workerId> "..."`
- **Edge általános task futtatás** → `brunella edge submit "..."`
- **Böngésző automatizálás magyarul** → `brunella robotkez chat "..."` vagy Dashboard **Robotkéz**
- **Projekt/track állapot** → `brunella conductor status` + `conductor/tracks.md`
- **Rendszer egészség** → Dashboard **System Health** + `npm run build && npm test`

---

## 2) Dashboard – Fő modulok és bekötöttség

## ✅ Bekötve és napi használatra kész

1. **Mission Control**
   - Widget alapú központi nézet
   - Forrás: `src/dashboard/lib/widgetRegistry.tsx`

2. **Neural Command (magyar task routing)**
   - Dashboardról magyar utasítás → Orchestrator routing
   - API: `POST /api/enterprise/execute`
   - Forrás: `src/dashboard/components/dashboard/NeuralCommandWidget.tsx`

3. **Cloudflare Workers Audit**
   - 6 worker inventory + live health/latency
   - Worker-szintű közvetlen task küldés gomb
   - API-k:
     - `GET /api/cloudflare/agents`
     - `POST /api/cloudflare/agents/:workerId/task`
   - Forrás: `src/dashboard/components/dashboard/CloudflareAgentsCard.tsx`

4. **Robotkéz (RobotkezV2)**
   - Böngésző agent vezérlés
   - Forrás: `src/dashboard/components/dashboard/RobotkezV2Chat.tsx`

5. **Task Queue / Suggested / Test Results / Process Control / System Health**
   - Működő, dashboardon elérhető panelek
   - Forrás: widget registry + kapcsolódó panelek

## ⚠️ Részben bekötve / környezetfüggő

1. **Cloudflare Deploy oldal**
   - UI oldala kész, használhatóság token/account és környezet függő
   - Forrás: `src/dashboard/pages/CloudflareDeployment.tsx`

2. **Edge és külső szolgáltatások**
   - Akkor teljes, ha env beállítások rendben (`EDGE_ENABLED`, URL-ek, tokenek)

## 🔌 Külső szolgáltatástól függ (nem „önmagában” bekötetlen, hanem integráció-függő)

1. **n8n Automation**
   - Embedded URL (helyi szolgáltatás futásától függ)
2. **Langflow Orchestration**
   - Embedded URL (helyi szolgáltatás futásától függ)

---

## 3) CLI puska (nagyvonalakban)

## Magyar feladatkiosztás
```bash
brunella task "Keress rá a legújabb AI hírekre"
brunella task            # interaktív magyar menü
```

## Cloudflare Edge / Workers
```bash
brunella edge status
brunella edge audit
brunella edge submit "általános edge feladat"
brunella edge submit-worker bas-orchestrator "feladat"
brunella edge history
```

## Robotkéz
```bash
brunella robotkez chat "Navigálj ide és keress rá erre"
brunella robotkez plan "..."
brunella robotkez status
brunella robotkez tasks list
```

## Conductor / projekt
```bash
brunella conductor status
brunella conductor health
```

---

## 4) Cloudflare Worker azonosítók (audit/dispatch)

A jelenlegi audit inventory szerint:

- `bas-orchestrator` (public)
- `brunella-cf` (public)
- `agents-api` (internal)
- `saas-admin` (internal)
- `llm-chat-app-template` (public)
- `throbbing-fire` (internal)

Megjegyzés: az internal workerek akkor lesznek élőben „online”, ha az URL env változók konfigurálva vannak.

---

## 5) Használati javaslat (gyors rutin)

1. **Reggeli check (1-2 perc)**
   - `npm run build`
   - `npm test`
   - `brunella edge audit`

2. **Feladat kiosztás**
   - Általános: `brunella task "..."`
   - Edge-specifikus: `brunella edge submit ...`
   - Worker-specifikus: `brunella edge submit-worker <id> ...`

3. **Dashboard monitor**
   - Mission Control + Cloudflare Workers Audit + Task Queue

---

## 6) Mi nincs meg külön fájlként?

- `conductor/tasks.md` **jelenleg nincs a repositoryban**.
- Nyitott track-ek listáját a `conductor/tracks.md` tartalmazza.

---

## 7) Nyitott track-ek (conductor/tracks.md alapján)

Aktív (6):
- `cloudflare_browser_rendering_robotkez_20260221`
- `cloudflare_d1_kv_storage_20260221`
- `cloudflare_vectorize_rag_20260221`
- `dashboard_v3_command_center_20260219`
- `innovation_bridge_20260212`
- `financial-auditor-agent-20260214` (100%, de active listában szerepel)

Proposed (5):
- `creative_friction_mediator_20260212`
- `gemini_git_agent_20260212`
- `invoice-e2e-testing-20260217`
- `jules_enterprise_cicd_20260212`
- `micro_csr_automator_20260212`

---

## 8) Rövid prioritási sorrend (mit érdemes folytatni)

### P0 – azonnal érdemes

1. **cloudflare_browser_rendering_robotkez_20260221**
   - Ok: közvetlen üzleti érték (Robotkéz + Cloudflare), jelenleg 0%-on áll.

2. **dashboard_v3_command_center_20260219**
   - Ok: most került be sok új edge/task funkció; dashboard oldali összerendezés kritikus a napi használathoz.

### P1 – közvetlen utána

1. **cloudflare_d1_kv_storage_20260221**
   - Ok: állapot/történet és worker-feladatok tartósítása D1/KV irányba.

2. **cloudflare_vectorize_rag_20260221**
   - Ok: tudásvisszakeresés és skálázott AI minőség; értékes, de előbb stabil storage kell.

### P2 – később / párhuzamosan

1. **innovation_bridge_20260212**
   - Ok: stratégiai, de nem blokkolja a mostani Cloudflare + Dashboard fókuszt.

### Housekeeping

- `financial-auditor-agent-20260214` 100%-on van, de még active blokkban szerepel; érdemes státusz-tisztítás (completed/archived flow).
