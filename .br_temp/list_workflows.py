"""n8n összes workflow listázása + részletes állapot"""
import json, urllib.request, sys

BASE = "https://iszapfalo.app.n8n.cloud/api/v1"
KEY = sys.argv[1]

req = urllib.request.Request(f"{BASE}/workflows?limit=50", headers={"X-N8N-API-KEY": KEY})
with urllib.request.urlopen(req, timeout=15) as r:
    d = json.loads(r.read())

wfs = d.get("data", [])
print(f"=== OSSZES WORKFLOW: {len(wfs)} ===\n")
aktiv = [w for w in wfs if w.get("active")]
inaktiv = [w for w in wfs if not w.get("active")]

print(f"AKTIV ({len(aktiv)}):")
for w in sorted(aktiv, key=lambda x: x.get("name", "")):
    print(f"  [OK] {w['id']} | {w['name']}")

print(f"\nINAKTIV ({len(inaktiv)}):")
for w in sorted(inaktiv, key=lambda x: x.get("name", "")):
    print(f"  [--] {w['id']} | {w['name']}")

print("\n=== CREDENTIAL LISTAK ===")
req2 = urllib.request.Request(f"{BASE}/credentials?limit=50", headers={"X-N8N-API-KEY": KEY})
try:
    with urllib.request.urlopen(req2, timeout=15) as r2:
        cd = json.loads(r2.read())
    creds = cd.get("data", [])
    print(f"Osszes credential: {len(creds)}")
    for c in sorted(creds, key=lambda x: x.get("name", "")):
        print(f"  [{c['type']}] {c['id']} | {c['name']}")
except Exception as e:
    print(f"Credential lista hiba: {e}")
