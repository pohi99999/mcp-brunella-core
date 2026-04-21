# Chrome ACP Setup a Brunella rendszerhez

## Cél
Ez a guide a Chrome ACP lokális használatát kapcsolja be a Brunella dashboard és CLI mellé.

## 1. Globális eszközök telepítése

```bash
npm install -g @chrome-acp/proxy-server @anthropic-ai/claude-code @zed-industries/claude-code-acp
```

> Megjegyzés: a `@zed-industries/claude-code-acp` csomag már deprecation figyelmeztetést ad, de jelenleg még kompatibilisen települ és a `claude-code-acp` binárist biztosítja. A későbbi migrációhoz érdemes figyelni a `@zed-industries/claude-agent-acp` irányt.

Szükséges binárisok:

- `acp-proxy`
- `claude-code-acp`
- `claude` / Claude Code runtime az ACP adapterhez

## 2. Proxy indítása

### Windows scriptből

```powershell
.\scripts\start-chrome-acp.ps1
```

vagy:

```bat
scripts\start-chrome-acp.bat
```

### Kézzel

```bash
acp-proxy --no-auth claude-code-acp
```

Sikeres indulás után a web UI tipikusan itt érhető el:

- `http://localhost:9315`

## 3. Dashboard használat

A Brunella dashboardban új **Chrome ACP** panel jelenik meg, ami a lokális ACP UI-t iframe-ben nyitja meg.

## 4. CLI használat

```bash
brunella chrome-acp
brunella chrome-acp doctor
brunella chrome-acp start
brunella chrome-acp install --run
```

### Elérhető funkciók

- `doctor` — binárisok + localhost UI ellenőrzése
- `status` — gyors állapotlekérdezés
- `start` — a Windows start script indítása
- `install` — megmutatja vagy lefuttatja a globális npm telepítést

## 5. Chrome extension

A proxy önmagában nem elég: a Chrome ACP extensiont is be kell állítani a böngészőben.

Javasolt lépések:

1. Telepítsd / töltsd be a Chrome ACP extensiont.
2. Kapcsold össze a lokális proxyval.
3. Ellenőrizd, hogy a browser toolok (`browser_tabs`, `browser_read`, `browser_execute`) megjelennek.
4. Ha kell, indítsd újra a proxyt és a böngészőt.

## 6. Hibaelhárítás

### `acp-proxy` nem található

A globális npm csomagok nincsenek telepítve vagy nincsenek PATH-ban.

### A `http://localhost:9315` nem nyílik meg

- a proxy nem indult el
- más folyamat fogja a portot
- a `claude-code-acp` adapter hiányzik

### A dashboard panel üres

- ellenőrizd, hogy a proxy már fut-e
- próbáld meg új lapon megnyitni a címet
- ha a beágyazás nem működik, használd az "Megnyitás új lapban" linket

## 7. Megjegyzés

A Chrome ACP nem MCP szerverként került a rendszerbe, ezért nem a `mcp_servers.json` része. A BAS-ben dashboard/CLI/script szinten kapott operatív támogatást.
