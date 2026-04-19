"""Gmail kategoriz\u00e1l\u00f3.json importálása n8n-be"""
import json
import urllib.request
import urllib.error

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZTMzZTc2ZC03YmJmLTRkZTgtOTg2Ny1kNDY0NmE0M2VmZjQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczNDE0MjM5LCJleHAiOjE3NzU5NDQ4MDB9.LuupmMbXzlYae0Etj1QS5AD0bwQoIcP-CtBWq4KzCes"
BASE = "https://iszapfalo.app.n8n.cloud/api/v1"
# Temp copy (no accents in path)
FPATH = r"F:\mcp-brunella-core\_br_temp\gmail_kat_temp.json"

with open(FPATH, "r", encoding="utf-8") as f:
    wf_data = json.load(f)

name = wf_data.get("name", "?")
node_count = len(wf_data.get("nodes", []))
print("Workflow nev: " + name)
print("Node szam: " + str(node_count))

# n8n API v1 requires direct workflow object (not wrapped in workflowData)
# Keep only the fields the API accepts
send_data = {
    "name": wf_data.get("name", "Gmail kategorizalo"),
    "nodes": wf_data.get("nodes", []),
    "connections": wf_data.get("connections", {}),
    "settings": wf_data.get("settings", {}),
    "staticData": wf_data.get("staticData")
}
payload = json.dumps(send_data).encode("utf-8")
req = urllib.request.Request(
    BASE + "/workflows",
    data=payload,
    method="POST",
    headers={
        "X-N8N-API-KEY": API_KEY,
        "Content-Type": "application/json"
    }
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.load(resp)
        print("SIKER! Uj workflow ID: " + str(result.get("id")))
        print("Nev: " + str(result.get("name")))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print("HIBA " + str(e.code) + ": " + body[:500])
