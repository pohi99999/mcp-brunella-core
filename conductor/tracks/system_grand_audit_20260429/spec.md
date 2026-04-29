# Spec — Brunella Grand Audit + @packages migration finalization

## Probléma

A repó vegyes állapotban: 762 uncommitted fájl egy folyamatban lévő `src/` →
`@packages/*` import refaktor maradványa. A build TS szinten zöld, de a
git status káosz. A felhasználó kérése (rendszer-szintű optimalizálás,
dashboard ↔ végpont szinkron, PAIOS főcsatorna, MCP racionalizáció,
GitHub main szinkron) ezen az állapoton nem indítható.

## Megoldás

1. **Refaktor zárás:** A `@packages/*` import migráció már egységes;
   tiszta kommitokra bontva commitra kerül (build és targeted vitest zöld).
2. **Audit:** Read-only felmérés a fent listázott területeken; jelentés
   `docs/sessions/`-be, prioritás-mátrix.
3. **Push:** `origin/main` szinkronra kerül.

## Hatáskörön kívüli

- `src/` legacy mappa migrációja (külön track jövőbeni)
- Cloudflare élő deploy
- Halott gombok automatikus törlése (csak dokumentálás)

## Elfogadási kritériumok

- `npm run build` ✅ (már bizonyítva)
- `npm run test:fast` ✅ (cél: zöld)
- `git status` tiszta vagy csak audit doc-ok
- `origin/main` ↔ `HEAD` szinkronban
- Audit jelentés a `docs/sessions/`-ben

## Kockázat

- Push előtt kötelező a teljes test:fast — ha piros baseline van, debug.
- A `src/` még él; a `@packages/*` refaktor nem érinti, ezért nem törünk
  el meglévő legacy hivatkozást.
