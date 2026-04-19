"""Fix a 02-es workflow node/8 'additional properties' hibáját és importálja"""
import json
import urllib.request
import urllib.error
import sys

N8N_BASE = "https://iszapfalo.app.n8n.cloud/api/v1"
KEY = sys.argv[1]

FPATH = "F:/mcp-brunella-core/docs/Egyéb/Iszapfull_nyilvan/IMPORT_READY_PACK_2026_03_13/02_ai_agent_asszisztens_v2_javitott.json"

# Betöltjük
with open(FPATH, encoding="utf-8") as f:
    d = json.load(f)

nodes = d.get("nodes", [])
print(f"Osszes node: {len(nodes)}")

# Szokásos n8n node kulcsok (az API által elfogadottak)
VALID_KEYS = {
    "id", "name", "type", "typeVersion", "position", "parameters",
    "credentials", "disabled", "notes", "notesInFlow", "retryOnFail",
    "maxTries", "waitBetweenTries", "continueOnFail", "alwaysOutputData",
    "executeOnce", "onError", "webhookId", "extendsCredential",
}

# Minden node-ból eltávolítjuk az ismeretlen kulcsokat
cleaned_nodes = []
for i, node in enumerate(nodes):
    extras = set(node.keys()) - VALID_KEYS
    if extras:
        print(f"  Node {i} ({node.get('type', '?')}): EXTRA KULCSOK -> {extras}")
    cleaned = {k: v for k, v in node.items() if k in VALID_KEYS}
    cleaned_nodes.append(cleaned)

# Settings tisztítás (n8n által elfogadott keys)
VALID_SETTINGS = {
    "saveManualExecutions", "saveExecutionProgress",
    "saveDataErrorExecution", "saveDataSuccessExecution",
    "executionTimeout", "timezone", "errorWorkflow",
    "callerPolicy", "callerIds", "executionOrder",
}
raw_settings = d.get("settings", {})
extra_settings = set(raw_settings.keys()) - VALID_SETTINGS
if extra_settings:
    print(f"  Settings: EXTRA KULCSOK eltávolítva -> {extra_settings}")
cleaned_settings = {k: v for k, v in raw_settings.items() if k in VALID_SETTINGS}

# Importálás a tisztított node-okkal
payload = {
    "name": d.get("name"),
    "nodes": cleaned_nodes,
    "connections": d.get("connections", {}),
    "settings": cleaned_settings,
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
        print(f"OK: {res.get('name')} -> ID: {res.get('id')}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"ERR {e.code}: {body[:400]}")
