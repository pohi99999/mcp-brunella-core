# Cloudflare Tunnel Beállítás - BAS Edge Integration

Ez a dokumentum a Cloudflare Tunnel létrehozását és konfigurálását írja le, hogy a BAS Orchestrator Worker elérje a lokális szolgáltatásokat (n8n, Browser-Use, BAS API).

---

## Előfeltételek

- [x] **cloudflared** telepítve (`cloudflared --version` → 2025.8.1)
- [X] Cloudflare fiók (ingyenes)
- [ ] (Opcionális) Saját domain Cloudflare-n kezelve – állandó URL-ekhez

---

## Lépés 1: Bejelentkezés Cloudflare-be

```powershell
cloudflared tunnel login
```

- Megnyílik a böngésző, jelentkezz be a Cloudflare fiókodba
- Válaszd ki a **zonát** (domain) amit a tunnel-hez használsz
- Ha nincs saját domain: válaszd a "Create a free zone" opciót, vagy használd a **Quick Tunnel**-t (lásd alább)

---

## Lépés 2: Named Tunnel létrehozása

```powershell
cloudflared tunnel create bas-tunnel
```

**Kimenet példa:**
```
Created tunnel bas-tunnel with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

A credentials fájl itt jön létre:
- **Windows:** `C:\Users\<felhasználónév>\.cloudflared\<tunnel-id>.json`
- Jegyezd fel a **tunnel ID**-t!

---

## Lépés 3: Config fájl létrehozása

Hozd létre a `config.yml` fájlt. Két lehetőség:

### A) Projekt mappában (ajánlott)

Másold a sablont és nevezd át:
```powershell
copy docs\tunnel-config.example.yml docs\tunnel-config.yml
```

Fájl: `F:\mcp-brunella-core\docs\tunnel-config.yml`

Lásd a `docs/tunnel-config.example.yml` sablont. A tartalom:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<FELHASZNÁLÓNÉV>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: n8n.bas.<TARTOMÁNYOD>
    service: http://localhost:5678
  - hostname: browser-use.bas.<TARTOMÁNYOD>
    service: http://localhost:8000
  - hostname: api.bas.<TARTOMÁNYOD>
    service: http://localhost:3000
  - service: http_status:404
```

**Cseréld ki:** `<TUNNEL_ID>`, `<FELHASZNÁLÓNÉV>`, `<TARTOMÁNYOD>`

### B) Ha NINCS saját domain – Quick Tunnel (teszteléshez)

A Quick Tunnel ideiglenes URL-t ad, ami **minden indításkor változik**. Nem ajánlott production-höz, de gyors teszteléshez jó:

```powershell
# n8n elérése (egy terminálban)
cloudflared tunnel --url http://localhost:5678

# Browser-Use (másik terminálban)
cloudflared tunnel --url http://localhost:8000
```

A parancs kiír egy URL-t (pl. `https://xxx-xxx-xxx.trycloudflare.com`) – ezt másold be ideiglenesen a wrangler.jsonc `vars`-ba.

---

## Lépés 4: DNS rekordok (Named Tunnel + saját domain)

Ha Named Tunnelt használsz saját domainnel:

```powershell
# CNAME rekordok létrehozása
cloudflared tunnel route dns bas-tunnel n8n.bas.<tartományod>
cloudflared tunnel route dns bas-tunnel browser-use.bas.<tartományod>
cloudflared tunnel route dns bas-tunnel api.bas.<tartományod>
```

Vagy manuálisan a Cloudflare Dashboard-ban:
- **Type:** CNAME
- **Name:** n8n.bas (vagy browser-use.bas, api.bas)
- **Target:** `<tunnel-id>.cfargotunnel.com`

---

## Lépés 5: Tunnel indítása

```powershell
cd F:\mcp-brunella-core
cloudflared tunnel run bas-tunnel --config docs/tunnel-config.yml
```

**Háttérben futtatás (Windows Service):**
```powershell
# Admin PowerShell
cloudflared service install
# A service a ~/.cloudflared/config.yml-t használja alapból
```

---

## Lépés 6: Worker frissítése a tunnel URL-ekkel

Ha a tunnel fut és a DNS rekordok aktívak, frissítsd a `bas-cloudflare-orchestrator/wrangler.jsonc`-t:

```jsonc
"vars": {
  "N8N_WEBHOOK_URL": "https://n8n.bas.<tartományod>/webhook/bas-task",
  "BROWSER_USE_ENDPOINT": "https://browser-use.bas.<tartományod>/api/task",
  "R2_PREFIX": "Brunella_core"
}
```

Majd deploy:
```powershell
cd bas-cloudflare-orchestrator
npx wrangler deploy
```

---

## Ellenőrzés

| Ellenőrzés | Parancs / URL |
|------------|---------------|
| Tunnel fut? | `cloudflared tunnel list` |
| n8n elérhető? | `curl https://n8n.bas.<domain>/health` |
| Browser-Use elérhető? | `curl https://browser-use.bas.<domain>/health` |
| Worker dispatch teszt | `curl -X POST https://bas-orchestrator.iam-dd1.workers.dev/task -H "Content-Type: application/json" -d '{"instruction":"Teszt"}'` |

---

## Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| "tunnel credentials not found" | Ellenőrizd a `credentials-file` útvonalát |
| "connection refused" | Indítsd el a lokális szolgáltatásokat (n8n, Python server) |
| DNS nem frissül | Várj 1-2 percet, vagy `cloudflared tunnel route dns` |
| Worker nem éri el a tunnel-t | Ellenőrizd hogy a tunnel fut-e és a URL-ek helyesek |

---

## Következő lépések (track)

1. [x] cloudflared telepítése
2. [ ] Tunnel létrehozása és login
3. [ ] config.yml konfiguráció
4. [ ] DNS rekordok és indítás
5. [ ] Worker frissítése tunnel URL-ekkel

---

*Dokumentum: Cloudflare Edge Integration track*
*Utolsó frissítés: 2026-02-03*
