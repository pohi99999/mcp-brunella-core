Google Workspace képességek (összefoglaló)

Rövid áttekintés (mit tudok megvalósítani a Google Workspace-szel):

- Gmail
  - Üzenetek lekérdezése (list, get), snippet/metadata, feladó, tárgy
  - Üzenet küldése (send) és draft-ok kezelése
  - Label-ek kezelése (create/apply/remove)

- Drive
  - Fájlok listázása, feltöltése, letöltése
  - Jogosultságok (permissions) olvasása és módosítása
  - Drive API: keresés, megosztás, fájlmeta

- Calendar
  - Események listázása, létrehozása, frissítése, törlése
  - Naptárak kezelése és megosztások

- Docs / Sheets / Slides
  - Dokumentumok olvasása és módosítása (Docs API), táblázatok olvasása/írása (Sheets API), prezentációk módosítása (Slides API)

- Forms
  - Űrlapok létrehozása, beállítások, válaszok lekérése (Forms API)

- Admin SDK (audit, directory)
  - Felhasználó- és csoport-információk lekérése, audit-logok olvasása
  - ADMIN scope-ok domain-admin jóváhagyást igényelnek

- Classroom, Chat, Meet, People, Keep, Apps Script
  - Classroom: kurzusok, bejegyzések, visszajelzések (admin/teaching scopes)
  - Chat: bot üzenetküldés, space-ek kezelése
  - People: névjegyek és profiladatok olvasása
  - Keep: jegyzetek kezelése
  - Apps Script: script projektek kezelése, futtatás (API és OAuth engedélyek szükségesek)

Jogosultságok, biztonság és megfontolandók:
- OAuth user-consent flow: a felhasználó engedélyezi a szükséges scope-okat; ez alkalmas interaktív demo-kra.
- Admin-scopok: domain-admin kell vagy service account + domain-wide delegation (javasolt ha automatizált háttérműveletek kellenek).
- Refresh token: offline access (access_type=offline) lehetővé teszi hosszú távú hozzáférést; tokenek titkos kezelése kötelező.

Mit készítettem a repóban:
- scripts/google_workspace/oauth_demo/oauth_server.js — helyi OAuth demo (listázza az utolsó 5 e-mailt)
- scripts/google_workspace/oauth_demo/README.md — használati útmutató
- docs/workflows/google-workspace-capabilities.md — ez a fájl: képességek összefoglalója

Következő lépések javaslat:
1) Ha szeretnéd, futtassuk a demo scriptet: állítsd be a GOOGLE_CLIENT_SECRET-et környezeti változóban, add hozzá a redirect URI-t a Google Console-ban, és futtasd a scriptet.
2) Ha admin-scopokat akarsz automatizálni, segítek service account + domain-wide delegation beállításában.
3) Commit/pull request készítés: szeretnéd, hogy commit-oljam a létrehozott fájlokat egy branch-re (pl. "workflow/google-workspace-demo") és nyissak PR-t?
