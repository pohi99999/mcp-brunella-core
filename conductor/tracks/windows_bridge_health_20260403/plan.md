# Windows Bridge Health Check Track

## Cél
A `windows_bridge/wab_server.py` (Windows Automation Bridge) számára health check endpoint és monitoring implementálása, hogy a rendszer automatikusan detektálhassa, ha a bridge nem elérhető.

## Probléma
- `mcp_servers.json`-ban a `windows_automation_bridge` szerver fut, de nincs `/health` endpoint
- A fő `npm run smoke` health check script nem ellenőrzi a WAB státuszát
- Ha a bridge leáll, a rendszer nem értesül róla automatikusan
- A Dashboard sem mutatja a bridge állapotát

## Jelenlegi Állapot
```
windows_bridge/wab_server.py → FastAPI szerver valamilyen porton
mcp_servers.json → "url": "http://localhost:..." (pontosítani kell)
```

## Megoldási Terv

### 1. Fázis: Health Endpoint a WAB-ba (1-2 óra)
- [ ] Megkeresni `windows_bridge/wab_server.py` jelenlegi állapotát
- [ ] `/health` endpoint hozzáadása:
  ```python
  @app.get("/health")
  async def health():
      return {"status": "ok", "service": "windows-automation-bridge", "version": "1.0"}
  ```
- [ ] Port dokumentálása

### 2. Fázis: Smoke Script Bővítése (30 perc)
- [ ] `scripts/smoke.js` vagy `scripts/smoke.sh` frissítése WAB check-kel
- [ ] Timeout: 3s — ha nem válaszol, warning (nem error, mert opcionális)

### 3. Fázis: Dashboard Widget (1-2 óra)
- [ ] System Health panel kibővítése WAB státusz badge-dzsel
- [ ] `src/server/routes/health.ts` → WAB proxy check

## Elfogadási Kritérium
- `GET http://localhost:<wab-port>/health` → `{"status": "ok"}`
- `npm run smoke` reportálja a WAB státuszát
- Dashboard System Health panel mutatja a bridge állapotát

## Érintett Fájlok
- `windows_bridge/wab_server.py`
- `scripts/smoke.js` (vagy `smoke.sh`)
- `src/server/routes/health.ts`
- `src/dashboard/components/dashboard/SystemHealth.tsx` (vagy hasonló)
