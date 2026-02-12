# Specifikáció: Dashboard TODO Widget (Real-time Track Progress)

**Track ID:** `dashboard-todo-widget-20260211`
**Spec státusz:** `pending_approval`
**Dátum:** 2026-02-12
**Owner:** Claude

## 1. Cél

Dashboard widget, ami az aktív trackek `track.md` TODO checkbox listáját **valós időben** mutatja, és lehetővé teszi a pipálást (UI + CLI).

## 2. Scope

### In-scope

- Backend endpointok:
  - `GET /api/tracks/:id/todos` – `track.md` checkboxok parse-olása
  - `PATCH /api/tracks/:id/todos/:todoId` – checkbox toggle + fájl visszaírás
- WebSocket/SSE real-time frissítés, ha a `track.md` változik
- Dashboard komponens:
  - track kiválasztás (dropdown)
  - checklist megjelenítés + toggle
  - progress bar (completed/total)
  - connection status
- CLI (magyar): track progress + TODO toggle menüből

### Out-of-scope (első iteráció)

- Többszereplős konfliktuskezelés (simultaneous edit) – első körben “last write wins” + egyszerű visszajelzés
- Rich markdown szerkesztő

## 3. Adatmodell

Parser kimenet (belső DTO):

```ts
interface TrackTodoItem {
  id: string;         // stabil azonosító (line-index + hash)
  text: string;
  completed: boolean;
}

interface TrackTodoView {
  trackId: string;
  trackTitle: string;
  status: string;
  todos: TrackTodoItem[];
  progress: number; // 0-100
}
```

## 4. Checkbox parser szabályok

- Markdown checkbox sorok:
  - `- [ ] ...`
  - `- [x] ...` (case-insensitive)
- Csak a track fájl TODO szekcióiból olvasunk (pl. “Implementation Plan” alatt), de első iterációban elég “minden checkbox sor”.

## 5. Funkcionális követelmények (Acceptance mapping)

1. Dashboard widget (Card) ✅
2. Active track lista + checklist ✅
3. Progress bar ✅
4. Checkbox toggle ✅
5. Real-time sync ✅
6. CLI progress (magyar) ✅

## 6. Biztonság

- Csak lokális fájlok: trackId whitelist a `conductor/tracks/` alá
- Path traversal védelem: `path.resolve` + prefix check

## 7. Tesztelés

- Unit: parser (külön modul)
- Unit: toggle write-back (id→line mapping)
- Integration: endpoint GET/PATCH
- Realtime: alap smoke (event emission)

## 8. Approval checklist

- [ ] API útvonalak és auth/hozzáférés tisztázott
- [ ] Parser szabályok elfogadva
- [ ] Real-time mechanizmus (WS vs SSE) eldöntve
