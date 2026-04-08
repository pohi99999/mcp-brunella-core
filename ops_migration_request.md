Ops: Migráció — engedélyezni a 'pending' approval_state

Összefoglaló
---------
A Learning Loop futása közben SQLite CHECK constraint hiba lépett fel: a futó DB csak az approval_state értékeit engedélyezte ('candidate','approved','rejected'), miközben a kód már 'pending'-et ír. Rövid távon egy kód-fallback került be (ha CHECK hiba: újrapróbálás legacy 'candidate'-del), hosszú távon migráció szükséges.

Módosított/érintett fájlok
-------------------------
- src/core/goldenDatasetBridge.ts (ideiglenes fallback a beszúrásnál)
- myai/agents/workers/orchestrator/migrations/0002_allow_pending_approval_state.sql
- scripts/migrations/20260407_allow_pending_approval_state.sql
- branch: fix/db-allow-pending-approval-state (remote: origin/fix/db-allow-pending-approval-state)
- PR draft: pr_fix_allow_pending_approval_state.md (repo root)

Mit kell futtatni (operátori lépések)
------------------------------------
1) Készíts teljes backupot (példa Linux):
   cp /path/to/brunella.db /path/to/brunella.db.bak
   (Windows PowerShell): Copy-Item C:\path\to\brunella.db C:\path\to\brunella.db.bak

2) Futtasd a migrációt (sqlite3):
   sqlite3 /path/to/brunella.db ".read scripts/migrations/20260407_allow_pending_approval_state.sql"

   Alternatív (Python):
   python - <<'PY'
import sqlite3
con = sqlite3.connect('/path/to/brunella.db')
with open('scripts/migrations/20260407_allow_pending_approval_state.sql','r',encoding='utf-8') as f:
    con.executescript(f.read())
con.commit()
con.close()
PY

3) Verifikáció:
   sqlite3 /path/to/brunella.db "SELECT approval_state, COUNT(*) FROM curated_golden_samples GROUP BY approval_state;"
   Ellenőrizd, hogy 'pending' szerepel, és nincsenek CHECK hibák a logokban.

Rollback (ha valami rosszul sül el)
------------------------------------
- Állítsd vissza a backupot:
  cp /path/to/brunella.db.bak /path/to/brunella.db
  (vagy Windows: Copy-Item -Force ...)

Utómunka (post-migration)
-------------------------
1) Futtass egy teljes tesztet: npm run test:fast (vagy CI pipeline)
2) Ha minden OK, merge-eld a PR-t: https://github.com/pohi99999/mcp-brunella-core/pull/new/fix/db-allow-pending-approval-state
3) A migráció lefutása és a PR merge után: eltávolítjuk a kód-fallbacket (commit: remove fallback), majd normalizáljuk az approval_state mezőt egy UPDATE candidate→pending művelettel (ha szükséges) és konszolidáljuk a migrációs fájlokat.

D1 / hosted DB megjegyzések
---------------------------
- Ha a DB D1 (Cloudflare Workers KV vagy D1) alapú, ellenőrizd a D1 kompatibilitási jegyzeteket a scripts/migrations fájlban. A script tartalmaz D1-specifikus megjegyzéseket; ops tudja igazítani az eszközre.

Megjegyzés a helyi környezetről
------------------------------
A jelen környezetben (CI/agent) nincs telepített sqlite3 vagy Python, ezért a migrációt itt nem tudtam lefuttatni. A branch és a migrációs SQL fájlok fent vannak a repóban.

Kérések
-------
- Kérlek futtasd a fenti lépéseket egy karbantartási ablakban és jelezd vissza az eredményt.
- Ha szeretnéd, elkészítem a Slack/email üzenet mintát az ops-csatornának, vagy megpróbálom lokálisan telepíteni a szükséges eszközöket és lefuttatni (ha engedélyt adsz erre).

Kapcsolat
--------
Branch: origin/fix/db-allow-pending-approval-state
PR fájl: pr_fix_allow_pending_approval_state.md (repo root)
Migrációs script: scripts/migrations/20260407_allow_pending_approval_state.sql

Készen állok az értesítésre és a koordinációra (ops), ha jóváhagyod.