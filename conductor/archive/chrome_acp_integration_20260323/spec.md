# Specifikáció: Chrome ACP integráció

## Háttér
A user kérte, hogy a Chrome ACP kerüljön be a Brunella rendszerbe. A quickstart szerint az alapfolyamat:

```bash
npm install -g @chrome-acp/proxy-server @anthropic-ai/claude-code @zed-industries/claude-code-acp
acp-proxy --no-auth claude-code-acp
```

Ezután a lokális web UI jellemzően a `http://localhost:9315` címen érhető el, a Chrome extension pedig a proxyhoz csatlakozik.

## Követelmények

### 1. Dashboard integráció
- Új menüpont: **Chrome ACP**
- `EmbeddedWorkflow` használata a lokális UI beágyazására
- Csak localhost URL legyen támogatott

### 2. CLI integráció
- `brunella chrome-acp` interaktív belépési pont
- `doctor`: binárisok + lokális UI elérhetőség
- `start`: Windows script indítása háttérben
- `install`: globális npm parancs megjelenítése vagy futtatása

### 3. Script támogatás
- Windows `.bat` és `.ps1` indítófájl
- Hibajelzés hiányzó globális binárisoknál
- Opcionális browser launch

### 4. Dokumentáció
- Setup guide a manuális Chrome extension lépésekhez
- Hibaelhárítás: hiányzó `acp-proxy`, nem indul a port 9315, extension nincs párosítva

## Nem-célok
- Nem módosítjuk a `package.json`-t globális eszközök miatt
- Nem tesszük a Chrome ACP-t MCP szerverré a `mcp_servers.json`-ban
- Nem automatizáljuk a Chrome extension telepítését
