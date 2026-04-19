"""Import error_mon, geppark, okos_ajanlo az n8n-be"""
import json
import urllib.request
import urllib.error
import os
import sys

N8N_BASE = "https://iszapfalo.app.n8n.cloud/api/v1"
KEY = sys.argv[1]

def post_wf(fpath, label):
    with open(fpath, encoding="utf-8") as f:
        d = json.load(f)
    payload = {
        "name": d.get("name", label),
        "nodes": d.get("nodes", []),
        "connections": d.get("connections", {}),
        "settings": d.get("settings", {}),
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{N8N_BASE}/workflows",
        data=data,
        headers={"X-N8N-API-KEY": KEY, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read())
            wf_id = res.get("id", "???")
            wf_name = res.get("name", "???")
            print(f"  OK: {wf_name} -> ID: {wf_id}")
            return wf_id
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERR {e.code}: {body[:300]}")
        return None

print("Importalom: error_mon, geppark, okos_ajanlo...")
post_wf("F:/mcp-brunella-core/_br_temp/error_mon.json", "Error Monitoring")
post_wf("F:/mcp-brunella-core/_br_temp/geppark.json", "Geppark Karbantartas")
post_wf("F:/mcp-brunella-core/_br_temp/okos_ajanlo.json", "Okos Ajanlo")
print("KESZ!")
