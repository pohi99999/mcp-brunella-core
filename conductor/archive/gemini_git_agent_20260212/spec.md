\# Track: Gemini Git Autonomous Agent Architecture



\*\*Dátum:\*\* 2026-02-12

\*\*Prioritás:\*\* HIGH

\*\*Status:\*\* PROPOSED



\## 🎯 Célkitűzés

Egy olyan öntanuló ágensrendszer létrehozása, amely a Git commit history-t és fájlrendszert használja memóriaként (`memory/`). Az ágens képes ütemezett "igények" (Demands) kiszolgálására, és Issue/PR alapú interakcióra. A rendszer a "Gemini CLI Git" architektúrát követi.



\## 🛠️ Érintett Fájlok

\- `.github/workflows/agent-scheduler.yml` (Ütemező)

\- `memory/skills/\*` (Képességek definíciója)

\- `memory/learnings/\*` (Tanulságok)

\- `memory/conversations/\*` (Kontextus)

\- `demands/\*` (Rendszeres feladatok)



\## 📅 Megvalósítási Terv (Phases)



\### Phase 1: Memory Architecture Setup (Az Agy Helye)

A mappa- és memóriastruktúra kialakítása, amely az ágens tudásbázisát alkotja.



1\.  \*\*Könyvtárszerkezet létrehozása:\*\*

&nbsp;   - `memory/skills/`: Újrafelhasználható tudás és guideline-ok tárolása.

&nbsp;   - `memory/learnings/`: Korábbi futások tapasztalatai, minták.

&nbsp;   - `memory/conversations/`: Többkörös interakciók kontextusa.

2\.  \*\*Konfiguráció:\*\*

&nbsp;   - Gemini API kulcs beállítása a GitHub Secrets-ben (`GEMINI\_API\_KEY`).

&nbsp;   - Workflow jogosultságok ellenőrzése (Read/Write, PR create).



\### Phase 2: Workflow Automation (A Szívverés)

Az ágens "életre keltése" GitHub Actions segítségével.



1\.  \*\*Scheduler Workflow:\*\*

&nbsp;   - Fájl: `.github/workflows/agent-scheduler.yml`

&nbsp;   - Trigger: Cron (pl. reggel 9:00) és `workflow\_dispatch`.

&nbsp;   - Logika: `Discover Demands` -> `Load Skill` -> `Execute` -> `Create PR`.

2\.  \*\*On-Demand Trigger:\*\*

&nbsp;   - Issue komment figyelése (`@gemini` említésre).

&nbsp;   - PR komment figyelése (Iteratív finomítás).



\### Phase 3: Skill \& Demand Definition (Az Első Képesség)

Egy konkrét use-case implementálása a rendszer tesztelésére (pl. Napi AI Hírek vagy Kódtippek).



1\.  \*\*Skill Létrehozása:\*\*

&nbsp;   - Definiálni egy `guidelines.md`-t a `memory/skills/ai-news-digest/knowledge/` alatt.

&nbsp;   - Meghatározni a végrehajtási módszertant és kimeneti elvárásokat.

2\.  \*\*Demand Létrehozása:\*\*

&nbsp;   - Létrehozni egy "Demand" fájlt, amely naponta lefut és meghívja a fenti Skill-t.



\### Phase 4: Self-Improvement Loop (Tanulás)

A visszacsatolási kör beépítése.



1\.  \*\*Learning mechanizmus:\*\*

&nbsp;   - Amikor egy PR merge-re kerül a `main` ágba, az ágensnek frissítenie kell a `memory/learnings` mappát a sikeres mintákkal.

&nbsp;   - Ha egy PR-t elutasítanak vagy javítást kérnek, azt "hibaként" kell rögzíteni a memóriában.



\## ✅ Definition of Done

\- \[ ] A `memory/` mappa struktúra létrejött.

\- \[ ] A `.github/workflows` alatt fut az ütemezett feladat.

\- \[ ] Az ágens képes reagálni, ha egy Issue-ban megemlítik (`@gemini`).

\- \[ ] Az ágens képes automatikusan PR-t nyitni egy elvégzett feladat után.

