# Jules Repo Beállítás – Másolható konfiguráció

Másold be a Jules felületre (pohi99999/mcp-brunella-core → Setup script, Environment variables).

---

## Setup script

Másold a teljes blokkot a **Setup script** mezőbe, majd kattints **Run and snapshot**:

```bash
#!/bin/bash
set -e
echo "[Jules] Setting up mcp-brunella-core..."

# Node.js
npm ci
npm run build

# Python (myai)
if [ -d myai ] && [ -f myai/requirements.txt ]; then
  pip install -r myai/requirements.txt
  export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"
fi

echo "[Jules] Setup complete. Run: npm test"
```

---

## Environment variables

Add hozzá a Jules **Environment variables** szekcióban (Key / Value / Description):

| Key | Value | Description |
|-----|-------|-------------|
| `WEB_UI_ENABLED` | `0` | Web UI kikapcsolva (CI/tesztek) |
| `NODE_ENV` | `test` | Teszt környezet |
| `PYTHONPATH` | `.` | Python modulok (myai) eléréséhez |

**Megjegyzés:** Ne adj meg titkos adatokat (API kulcsok, jelszavak). Azokat a GitHub Secrets-ben tárold.

---

## Network access

**Engedélyezd** – szükséges az npm/pip csomagok letöltéséhez és a tesztekhez.

---

## Gyors ellenőrzés

Setup után a Jules VM-ben futtatható:

```bash
npm test
```
