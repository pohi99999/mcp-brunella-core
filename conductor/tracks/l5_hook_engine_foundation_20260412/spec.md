# Track Spec: Hook Engine Foundation

## Cél
A Brunella rendszer "idegrendszerének" kiépítése, amely lehetővé teszi az eseményvezérelt működést (Event-Driven Architecture). A cél egy központi `AgentHookEngine` osztály létrehozása, amely kezeli a hookok regisztrációját, aktiválását (firing) és auditálását.

## Funkcionális Követelmények
1. **Regisztráció:** Ügynökök vagy rendszerkomponensek feliratkozhatnak specifikus eseményekre.
2. **Aktiválás (Fire):** Esemény bekövetkezésekor a kapcsolódó hookok aszinkron módon lefutnak.
3. **Audit:** Minden hook-hívás naplózásra kerül az Event Store-ba.
4. **Hibakezelés:** Alapvető Dead Letter Queue (DLQ) és Circuit Breaker logika az instabil hookok ellen.

## Technikai Részletek
- **Fájl:** `src/core/agentHookEngine.ts`
- **Adattárolás:** SQLite alapú perzisztencia (az `event_store` táblán keresztül).
- **Minta:** Observer / Pub-Sub pattern.

## Első Éles Hookok
- `invoice:received` -> Számla feldolgozás indítása (OCR).
- `email:classified` -> Bejövő levelek irányítása.
- `cron:daily:briefing` -> Reggeli összefoglaló generálása.
- `agent:task:failed` -> Phoenix Protocol öngyógyító folyamat trigger.
- `build:failed` -> Automatikus build javítás indítása.
