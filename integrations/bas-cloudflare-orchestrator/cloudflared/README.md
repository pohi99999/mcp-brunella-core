# Cloudflare Tunnel Setup for BAS

## Quick Start (No Domain)

Ha nincs custom domain, használd a gyors módszert:

```bash
# Start tunnel with auto-generated URL
cloudflared tunnel --url http://localhost:3000
```

Ez egy ideiglenes URL-t generál (pl. `https://xyz.trycloudflare.com`), ami a lokális 3000-es portot teszi elérhetővé.

⚠️ **Figyelem:** Az URL **változik minden újraindításkor**!

---

## Permanent Setup (Custom Domain or Persistent URL)

### 1. Authentication

```bash
cloudflared tunnel login
```

Ez megnyit egy böngészőt → jelentkezz be Cloudflare-ben.

### 2. Create Tunnel

```bash
cloudflared tunnel create bas-local-bridge
```

**Output példa:**

```
Tunnel credentials written to: C:\Users\YourUser\.cloudflared\abcd1234-5678-90ef-ghij-klmnopqrstuv.json
Created tunnel bas-local-bridge with id abcd1234-5678-90ef-ghij-klmnopqrstuv
```

Jegyezd fel:

- **Tunnel UUID:** `abcd1234-5678-90ef-ghij-klmnopqrstuv`
- **Credentials fájl:** `C:\Users\YourUser\.cloudflared\abcd1234-5678-90ef-ghij-klmnopqrstuv.json`

### 3. Configure Tunnel

Szerkeszd a `config.yml` fájlt:

```yaml
tunnel: abcd1234-5678-90ef-ghij-klmnopqrstuv  # ← Helyettesítsd a UUID-val
credentials-file: C:\Users\YourUser\.cloudflared\abcd1234-5678-90ef-ghij-klmnopqrstuv.json  # ← Helyes elérési út
```

### 4. Configure DNS (Optional - ha van custom domain)

Ha van saját domain (pl. `mydomain.com`):

```bash
# Create CNAME record: api.mydomain.com → tunnel
cloudflared tunnel route dns bas-local-bridge api.mydomain.com

# Create more subdomains as needed
cloudflared tunnel route dns bas-local-bridge n8n.mydomain.com
cloudflared tunnel route dns bas-local-bridge browser.mydomain.com
```

Ha **NINCS** custom domain: skip ez a lépés, használd a `.trycloudflare.com` URL-eket.

### 5. Start Tunnel

```bash
cd bas-cloudflare-orchestrator/cloudflared
cloudflared tunnel --config config.yml run
```

**Sikeres indítás jele:**

```
INF Connection registered: https://n8n-bas.trycloudflare.com
INF Connection registered: https://browser-bas.trycloudflare.com
INF Connection registered: https://api-bas.trycloudflare.com
```

---

## Testing

### Local Service Check

Győződj meg róla, hogy a szolgáltatások futnak:

```bash
# BAS backend
curl http://localhost:3000/api/health

# n8n
curl http://localhost:5678

# Browser-Use / myai
curl http://localhost:8000

# Dashboard
curl http://localhost:5173
```

### Tunnel Check

Próbáld elérni a tunnel URL-eket külsőleg:

```bash
curl https://api-bas.trycloudflare.com/api/health
```

Ha `200 OK` választ kapsz → tunnel működik! ✅

---

## Environment Variables Update

Miután a tunnel elindul, frissítsd a `.env` fájlt:

```bash
# Példa URL-ek (a tied más lesz!)
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_TUNNEL_URL=https://api-bas.trycloudflare.com
CLOUDFLARE_TUNNEL_N8N_URL=https://n8n-bas.trycloudflare.com
CLOUDFLARE_TUNNEL_BROWSER_URL=https://browser-bas.trycloudflare.com
CLOUDFLARE_TUNNEL_DASHBOARD_URL=https://dashboard-bas.trycloudflare.com
```

---

## Troubleshooting

### "Tunnel credentials invalid"

- Ellenőrizd, hogy a `credentials-file` elérési út helyes-e
- Windows-on használj dupla backslash-t: `C:\\Users\\...`

### "Connection failed"

- Ellenőrizd, hogy a lokális szolgáltatás fut-e (pl. `localhost:3000`)
- Firewall blokkolhatja a `cloudflared` folyamatot

### "DNS record not found"

- Ha custom domain-t használsz, ellenőrizd a CNAME bejegyzést Cloudflare Dashboard-on
- Propagáció eltarthat 1-2 percig

### URL változik újraindításkor

- Ez normális, ha a "Quick Start" módot használod
- Megoldás: Állandó tunnel a `config.yml`-lel (lásd fent)

---

## Running as Service (Optional)

Windows Service:

```bash
cloudflared service install
cloudflared service start
```

Linux Systemd:

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
```

---

## Security Notes

🔐 **A tunnel biztonságos:**

- Zero-trust alapú (Cloudflare proxy)
- Nincs nyitott port a routeren
- TLS/SSL automatikusan bekapcsolva

⚠️ **Ne add ki a credentials fájlt:**

- `.gitignore` tartalmazza: `*.json` a `cloudflared/` mappában
- Soha ne commitolj credentials-t Git-re!

---

**Documentation:**  
<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>
