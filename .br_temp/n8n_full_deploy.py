"""
Iszapfaló - n8n Teljes Feltöltő & Aktiváló Script
=================================================
Futtatni MIUTÁN n8n online:
  https://iszapfalo.app.n8n.cloud (böngészőből felébreszteni)

Mit csinál:
  1. Munkaidő workflow fix feltöltése + aktiválás
  2. Error Monitoring aktiválás
  3. Heti Kontextus Csomag importálása
"""
import requests
import json
import sys
import time

# ============ KONFIGURÁCIÓ ============
N8N_URL = "https://iszapfalo.app.n8n.cloud/api/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZTMzZTc2ZC03YmJmLTRkZTgtOTg2Ny1kNDY0NmE0M2VmZjQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczNDE0MjM5LCJleHAiOjE3NzU5NDQ4MDB9.LuupmMbXzlYae0Etj1QS5AD0bwQoIcP-CtBWq4KzCes"
HEADERS = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}

MUNKADO_WF_ID = "WMAB7hYqJObUwAHN"
ERROR_MON_WF_ID = "Ofgnqc8dgFshia0b"
MUNKADO_FIXED_PATH = r"F:\mcp-brunella-core\_br_temp\munkado_FIXED.json"
HETI_KONTEXTUS_PATH = r"F:\mcp-brunella-core\_br_temp\heti_kontextus_csomag.json"

# ============ HELPER ============
def check_online():
    try:
        r = requests.get(f"{N8N_URL}/workflows?limit=1", headers=HEADERS, timeout=10)
        return r.status_code == 200
    except Exception:
        return False

def step(msg):
    print(f"\n{'='*60}\n⚡ {msg}\n{'='*60}")

def ok(msg):
    print(f"   ✅ {msg}")

def warn(msg):
    print(f"   ⚠️  {msg}")

def err(msg):
    print(f"   ❌ {msg}")

# ============ STEP 1: ONLINE CHECK ============
step("Online ellenőrzés")
if not check_online():
    err("n8n OFFLINE (503)! Kérlek nyisd meg böngészőben: https://iszapfalo.app.n8n.cloud")
    print("\n   Próbáljuk kicsit várni...")
    for i in range(3):
        time.sleep(5)
        if check_online():
            ok("n8n online!")
            break
        print(f"   Várakozás... ({i+1}/3)")
    else:
        err("n8n nem érhető el. Futtasd újra miután online.")
        sys.exit(1)
else:
    ok("n8n online!")

# ============ STEP 2: MUNKAIDŐ FIX ============
step(f"Munkaidő workflow fix feltöltése (ID: {MUNKADO_WF_ID})")

with open(MUNKADO_FIXED_PATH, 'r', encoding='utf-8') as f:
    munkado_data = json.load(f)

# Meglévő workflow adatok lekérése (connections megőrzéséhez)
print(f"   Meglévő workflow lekérése...")
r = requests.get(f"{N8N_URL}/workflows/{MUNKADO_WF_ID}", headers=HEADERS, timeout=10)
if r.status_code != 200:
    err(f"Nem sikerült lekérni: {r.status_code} - {r.text[:200]}")
else:
    existing = r.json()
    ok(f"Meglévő workflow neve: {existing.get('name', '?')}")
    
    # A fixed JSON-t az API elvárásainak megfelelően mergeljük
    upload_body = {
        "name": munkado_data.get("name", existing.get("name")),
        "nodes": munkado_data.get("nodes", existing.get("nodes")),
        "connections": munkado_data.get("connections", existing.get("connections")),
        "settings": munkado_data.get("settings", existing.get("settings", {})),
        "staticData": existing.get("staticData")
    }
    
    print(f"   Feltöltés...")
    r2 = requests.put(
        f"{N8N_URL}/workflows/{MUNKADO_WF_ID}",
        headers=HEADERS,
        json=upload_body,
        timeout=15
    )
    
    if r2.status_code in [200, 201]:
        ok(f"Munkaidő workflow frissítve! ({r2.status_code})")
    else:
        err(f"Feltöltési hiba: {r2.status_code}")
        print(f"   Response: {r2.text[:300]}")

# Aktiválás
print(f"   Aktiválás...")
r3 = requests.patch(
    f"{N8N_URL}/workflows/{MUNKADO_WF_ID}",
    headers=HEADERS,
    json={"active": True},
    timeout=10
)
if r3.status_code == 200:
    ok("Munkaidő workflow AKTÍV! ✅")
else:
    warn(f"Aktiválás: {r3.status_code} - {r3.text[:200]}")

# ============ STEP 3: ERROR MONITORING ============
step(f"Error Monitoring aktiválás (ID: {ERROR_MON_WF_ID})")

r = requests.patch(
    f"{N8N_URL}/workflows/{ERROR_MON_WF_ID}",
    headers=HEADERS,
    json={"active": True},
    timeout=10
)
if r.status_code == 200:
    ok("Error Monitoring AKTÍV! ✅")
elif r.status_code == 404:
    err("Workflow nem található. Lehet hogy törölték?")
else:
    warn(f"Aktiválás eredmény: {r.status_code} - {r.text[:300]}")

# ============ STEP 4: HETI KONTEXTUS CSOMAG IMPORT ============
step("Heti Kontextus Csomag importálása")

with open(HETI_KONTEXTUS_PATH, 'r', encoding='utf-8') as f:
    heti_data = json.load(f)

# Ellenőrzés: nem létezik-e már?
r = requests.get(f"{N8N_URL}/workflows?limit=100", headers=HEADERS, timeout=10)
if r.status_code == 200:
    existing_wfs = r.json().get("data", [])
    already_exists = [w for w in existing_wfs if w.get("name") == "Iszapfaló - Heti Kontextus Csomag"]
    if already_exists:
        warn(f"Már létezik: ID={already_exists[0]['id']} - Kihagyva (frissítés manuálisan)")
    else:
        import_body = {
            "name": heti_data["name"],
            "nodes": heti_data["nodes"],
            "connections": heti_data["connections"],
            "settings": heti_data.get("settings", {"executionOrder": "v1"}),
            "active": False
        }
        r2 = requests.post(
            f"{N8N_URL}/workflows",
            headers=HEADERS,
            json=import_body,
            timeout=15
        )
        if r2.status_code in [200, 201]:
            new_id = r2.json().get("id", "?")
            ok(f"Heti Kontextus Csomag importálva! ID: {new_id}")
            print(f"\n   ⚠️  KÖVETKEZŐ LÉPÉS:")
            print(f"   Nyisd meg az n8n-ben: https://iszapfalo.app.n8n.cloud/workflow/{new_id}")
            print(f"   Code - Inicializálás node-ban:")
            print(f"   gergo_chat_id -> Gergő valódi Telegram Chat ID-ja")
            print(f"   (Kaphatja úgy: /start üzenet a bot-nak -> Chat ID megjelenik)")
        else:
            err(f"Import hiba: {r2.status_code}")
            print(f"   Response: {r2.text[:400]}")

# ============ ÖSSZESÍTÉS ============
step("ÖSSZESÍTÉS")
print("\n   Jelenlegi workflow állapot:")
r = requests.get(f"{N8N_URL}/workflows?limit=100", headers=HEADERS, timeout=10)
if r.status_code == 200:
    wfs = r.json().get("data", [])
    aktiv = [w for w in wfs if w.get("active")]
    inaktiv = [w for w in wfs if not w.get("active")]
    print(f"\n   ✅ AKTÍV ({len(aktiv)} db):")
    for w in aktiv:
        print(f"      • {w['name']}")
    print(f"\n   ⏸️  INAKTÍV ({len(inaktiv)} db):")
    for w in inaktiv:
        print(f"      • {w['name']} [ID: {w['id']}]")

print("\n" + "="*60)
print("🎯 KÉSZ! Teendők:")
print("   1. ✏️  Heti Kontextus Csomag: gergo_chat_id beállítása")
print("   2. 💬 Gergőtől Telegram Chat ID bekérése")
print("   3. 🔑 Telegram bot token: 'Telegram account 4' (ID: lEp8aDHGJcOoUhAT)")
print("      → Ha megvan, 5 workflow aktiválható: Geppark, Okos Ajanlo,")
print("        Telegram Hangvezérlés, AI Agent, Telegram Parancsok")
print("="*60)
