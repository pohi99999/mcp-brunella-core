# MCP Config Sync Track

## Cél
Szinkronizálni és konzisztenssé tenni a két MCP konfigurációs fájlt:
- `mcp_servers.json` — Claude Desktop / MCP CLI belső konfig
- `.vscode/mcp.json` — VSCode Insiders / GitHub Copilot Chat konfig

## Probléma
A két fájl egymástól függetlenül fejlődött, eltérő szerverlistával:
- `mcp_servers.json`: 4 szerver (brunella-core, sqlite[disabled], filesystem, windows_automation_bridge)
- `.vscode/mcp.json`: 13 szerver (brunella, chrome-devtools, desktop-commander, context7, github-mcp, next-devtools, cloudflare, sqlite[disabled], fetch, memory, sequential-thinking, filesystem, playwright-mcp)

Manuális szinkronizálás hibalehetőséget jelent (pl. sqlite disabled volt az egyik-ben, a másikban nem).

## Megoldási Terv

### 1. Fázis: Audit (1-2 óra)
- [ ] Összehasonlítani a két fájl szerverlistáját
- [ ] Azonosítani: melyik szerver melyik kliensnek szól (MCP CLI vs VSCode)
- [ ] Dokumentálni a szándékolt különbségeket (ha vannak)

### 2. Fázis: Sync Script (2-3 óra)
- [ ] `scripts/sync_mcp_config.js` script írása
  - Beolvassa mindkét fájlt
  - Összehasonlítja a szerverlistát
  - Reportálja a különbségeket
  - Opcionálisan: szinkronizálja a közös részeket
- [ ] `package.json`-ba: `"mcp:sync": "node scripts/sync_mcp_config.js"`

### 3. Fázis: Validáció (1 óra)
- [ ] `scripts/validate_mcp_config.js` — JSON séma ellenőrzés mindkét fájlra
- [ ] CI-ba integrálni (`.github/workflows/ci.yml`)
- [ ] Dokumentáció frissítés: CLAUDE.md

## Elfogadási Kritérium
- Sync script fut és reportál konzisztencia-problémákat
- CI megakadályozza az eltérések commitolását figyelmeztetés nélkül
- CLAUDE.md tartalmazza a `npm run mcp:sync` parancsot

## Érintett Fájlok
- `mcp_servers.json`
- `.vscode/mcp.json`
- `scripts/sync_mcp_config.js` (új)
- `scripts/validate_mcp_config.js` (új)
- `package.json`
- `.github/workflows/ci.yml`
