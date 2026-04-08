PR: fix(golden-dataset): allow 'pending' approval_state + migration

Probléma: A Learning Loop futása közben SQLite CHECK constraint hiba: approval_state csak ('candidate','approved','rejected') volt engedélyezve, a kód viszont 'pending'-et ír – ez séma-driftet okozott és hibát dobott.

Változtatások:
- src/core/goldenDatasetBridge.ts: ideiglenes fallback: ha az INSERT/UPSERT CHECK hibát dob, újrapróbálás legacy 'candidate' értékkel (megakadályozza a szolgáltatás kiesését).
- myai/agents/workers/orchestrator/migrations/0002_allow_pending_approval_state.sql: biztonságos copy-swap migráció (candidate→pending mapping).
- scripts/migrations/20260407_allow_pending_approval_state.sql: operátori script, rollback és verifikációs lépésekkel.

Verifikáció (lokálisan):
1. Backup: copy data\\brunella.db data\\brunella.db.bak
2. Futtasd a migrációt (sqlite3 vagy Python): sqlite3 data\\brunella.db ".read scripts/migrations/20260407_allow_pending_approval_state.sql"
3. Ellenőrizd: sqlite3 data\\brunella.db "SELECT approval_state, COUNT(*) FROM curated_golden_samples GROUP BY approval_state;"

Megjegyzések & open items:
- Lokálisan a gyors tesztek közben FastAPI health-check tesztek időtúllépést jeleztek (környezeti függőségek: Python/FastAPI). A migrációt és teljes tesztet CI-ben/ops környezetben javaslom futtatni.
- Ha a migráció lefutott, eltávolítjuk a kód-fallbacket és normalizáljuk az approval_state mezőt (UPDATE candidate→pending), majd konszolidáljuk a migrációs fájlokat.

Operátori lépések (prod/D1):
1. Készítsen teljes backupot: cp /path/to/db /path/to/db.bak
2. Futtassa a scripts/migrations/20260407_allow_pending_approval_state.sql scriptet sqlite3/DB clienttel
3. Verifikálja az approval_state eloszlást
4. Ha minden OK, futtasson full CI-t és merge-ölje a PR-t

Megjegyzés: A GitHub API-val PR létrehozása sikertelen (403). Hozzáférés hiányzik; a PR tartalma készen van és a branch feltöltve: origin/fix/db-allow-pending-approval-state

PR létrehozása weben: https://github.com/pohi99999/mcp-brunella-core/pull/new/fix/db-allow-pending-approval-state

Kérlek jelezd, ha automatikusan létrehozzak PR-t (ha adsz hozzáférést), vagy ha futtassam a migrációt a helyi gépen (itt nincs sqlite3/python).