"""
Iszapfaló n8n Auto-Fix Script
Elvégzi: DELETE hibás + POST korrekt JSON workflow-k
"""
import json, time, sys, os
import urllib.request
import urllib.error

API_BASE = "https://iszapfalo.app.n8n.cloud/api/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZTMzZTc2ZC03YmJmLTRkZTgtOTg2Ny1kNDY0NmE0M2VmZjQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczNDE0MjM5LCJleHAiOjE3NzU5NDQ4MDB9.LuupmMbXzlYae0Etj1QS5AD0bwQoIcP-CtBWq4KzCes"
BASE_DIR = r"F:\mcp-brunella-core\docs\Egyéb\Iszapfull_nyilvan\POHI MŰVEK - megosztott mappa\Pohi Munkaidő json-ok"

HEADERS = {
    "X-N8N-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

# DELETE + reimport feladatok
REIMPORT_TASKS = [
    {
        "delete_id": "SstCWGS6YpkPEfAy",
        "name": "Geppark Karbantartas",
        "json_file": "Iszapfalo - Geppark Karbantartas (All-in-One).json"
    },
    {
        "delete_id": "fHJIvrbFaY012dNp",
        "name": "Okos Ajanlo",
        "json_file": "Iszapfalo - Okos Ajanlato Asszisztens.json"
    },
    {
        "delete_id": "CZSN8FZBoE8GyFuF",
        "name": "Telegram Hangvezerles",
        "json_file": "Iszapfalo - Telegram Hangvezerles.json"
    },
    {
        "delete_id": "epDHGWixQvrrfAHA",
        "name": "Error Monitoring",
        "json_file": "Iszapfalo - Error Monitoring es Logging.json"
    }
]

def api_request(method, path, body=None):
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as e:
        return {"error": e.reason, "status": e.code}, e.code

def wait_for_online(max_wait=120):
    print("Ellenőrzöm n8n elérhetőségét...")
    for i in range(max_wait // 5):
        resp, status = api_request("GET", "/workflows?limit=1")
        if status == 200:
            print(f"✅ n8n ONLINE (attempt {i+1})")
            return True
        print(f"  ❌ Offline (503) - várok 5 másodpercet... [{i*5}/{max_wait}s]")
        time.sleep(5)
    print("❌ n8n nem jött online {max_wait}s alatt")
    return False

def load_workflow_json(json_file):
    path = os.path.join(BASE_DIR, json_file)
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    # n8n cloud export formátum: {"data": {...}}
    data = raw.get("data", raw)
    return {
        "name": data["name"],
        "nodes": data["nodes"],
        "connections": data["connections"],
        "settings": data.get("settings", {}),
    }

def do_reimport(task):
    name = task["name"]
    delete_id = task["delete_id"]
    json_file = task["json_file"]
    
    print(f"\n{'='*50}")
    print(f"TEENDŐ: {name}")
    
    # 1. GET jelenlegi állapot
    current, status = api_request("GET", f"/workflows/{delete_id}")
    if status == 200:
        print(f"  Jelenlegi: {current.get('name')} (aktív: {current.get('active')})")
    elif status == 404:
        print(f"  ⚠️  Workflow {delete_id} már nem létezik - csak importálom")
        delete_id = None
    else:
        print(f"  GET hiba: {status} - {current}")
    
    # 2. DELETE
    if delete_id:
        _, del_status = api_request("DELETE", f"/workflows/{delete_id}")
        if del_status in (200, 204):
            print(f"  ✅ DELETE {delete_id}: OK")
        else:
            print(f"  ⚠️  DELETE hiba: {del_status}")
    
    # 3. Load JSON
    try:
        wf = load_workflow_json(json_file)
        print(f"  📄 JSON betöltve: {wf['name']} ({len(wf['nodes'])} node)")
    except Exception as e:
        print(f"  ❌ JSON betöltési hiba: {e}")
        return None
    
    # 4. POST
    result, post_status = api_request("POST", "/workflows", wf)
    if post_status == 200:
        new_id = result.get("id")
        print(f"  ✅ POST OK - új ID: {new_id}")
        return new_id
    else:
        print(f"  ❌ POST hiba: {post_status} - {result}")
        return None

def activate_workflow(wf_id):
    result, status = api_request("POST", f"/workflows/{wf_id}/activate")
    if status == 200:
        print(f"  ✅ Aktiválva: {wf_id}")
    else:
        print(f"  ⚠️  Aktiválás hiba: {status} - {result}")

def get_munkado_workflow():
    """Letölti és mentei a Munkaidő workflow-t javításhoz"""
    WF_ID = "WMAB7hYqJObUwAHN"
    result, status = api_request("GET", f"/workflows/{WF_ID}")
    if status == 200:
        output_path = r"F:\mcp-brunella-core\_br_temp\munkado_current.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"✅ Munkaidő workflow mentve: {output_path}")
        return result
    else:
        print(f"❌ Munkaidő GET hiba: {status}")
        return None

if __name__ == "__main__":
    print("=== Iszapfaló n8n Auto-Fix ===")
    
    # Várjuk meg hogy online legyen
    if not wait_for_online(max_wait=120):
        sys.exit(1)
    
    # 1. Munkaidő workflow letöltése javításhoz
    print("\n--- Munkaidő workflow lekérése ---")
    munkado = get_munkado_workflow()
    
    # 2. Reimport feladatok
    print("\n--- DELETE + REIMPORT ---")
    new_ids = {}
    for task in REIMPORT_TASKS:
        new_id = do_reimport(task)
        if new_id:
            new_ids[task["name"]] = new_id
            # Geppark-ot és Okos Ajanlo-t NE aktiváljuk mert a Telegram credential hiányzik
            # (kivéve Error Monitoring ami nem Telegram-függő)
            if task["name"] == "Error Monitoring":
                activate_workflow(new_id)
    
    print("\n=== ÖSSZEFOGLALÓ ===")
    for name, wf_id in new_ids.items():
        print(f"  {name}: https://iszapfalo.app.n8n.cloud/workflow/{wf_id}")
    
    print("\n⚠️  FIGYELEM: Geppark, Telegram Hangvezérlés és Okos Ajanlo")
    print("   nem aktiválható mert a 'Telegram account 4' credential hiányzik!")
    print("   Kérj Telegram bot token-t a megrendelőtől.")
