# FILE: myai/browser_worker.py
# PURPOSE: Felkészített browser-use ágens – API és UI (Browser-Use) mód scenario alapú feladatvégzésre.

import os
import json
import asyncio
import re
from typing import Any, Dict, Optional
from dotenv import load_dotenv
import requests
from pydantic import ValidationError
from myai.pydantic_models import validate_with_schema

load_dotenv()


def _is_ui_scenario(config: dict) -> bool:
    """True ha a scenario UI módot igényel (login, click stb.)."""
    if config.get("mode") == "ui":
        return True
    steps = config.get("steps", [])
    if steps and steps[0].get("action") in ("login", "click"):
        return True
    return False


def _is_extraction_scenario(config: dict) -> bool:
    """True ha a scenario strukturált adatkinyerést kér."""
    return bool(config.get("extraction_schema") or config.get("extraction"))


def _load_schema_source(schema_source: str) -> Dict[str, Any]:
    """Load JSON schema from file path or raw JSON string."""
    if os.path.exists(schema_source):
        with open(schema_source, "r", encoding="utf-8") as f:
            return json.load(f)
    return json.loads(schema_source)


def _extract_json_blob(text: str) -> Optional[str]:
    """Extract first JSON object/array from text."""
    match = re.search(r"\{.*\}|\[.*\]", text, re.DOTALL)
    return match.group(0) if match else None



async def run_n8n_api_scenario(scenario_path: str):
    # Szcenárió betöltése
    with open(scenario_path, 'r') as f:
        config = json.load(f)

    # Környezeti változók ellenőrzése
    n8n_api_key = os.getenv("N8N_API_KEY")
    n8n_base_url = os.getenv("N8N_TEST_URL")

    if not n8n_api_key or not n8n_base_url:
        print("HIBA: N8N_API_KEY vagy N8N_TEST_URL hiányzik a .env fájlból!")
        return {"error": "N8N API kulcs vagy URL hiányzik."}

    headers = {
        "X-N8N-API-KEY": n8n_api_key,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    # Segédfüggvény az n8n API hívásokhoz
    def call_n8n_api(method: str, endpoint: str, data: dict = None):
        url = f"{n8n_base_url}/api/v1/{endpoint}"
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            response.raise_for_status() # Hibát dob, ha a státuszkód 4xx vagy 5xx
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"HIBA az n8n API hívása során ({method} {url}): {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"API Response: {e.response.text}")
            return {"error": str(e)}

    created_workflow_id = None
    created_workflow_name = None

    for step in config['steps']:
        if step['action'] == "create_workflow":
            print(f"Creating new workflow: {step.get('new_name', 'Untitled Workflow')}")
            workflow_name = step.get('new_name', 'Új munkafolyamat')
            
            # API hívás új munkafolyamat létrehozására
            new_workflow_data = {"name": workflow_name, "nodes": [], "connections": {}, "settings": {}}
            response = call_n8n_api("POST", "workflows", new_workflow_data)
            
            if "error" in response:
                return {"error": f"Hiba a munkafolyamat létrehozása során: {response['error']}"}
            
            created_workflow_id = response.get('id')
            created_workflow_name = response.get('name')
            print(f"Workflow created: {created_workflow_name} (ID: {created_workflow_id})")
            
        elif step['action'] == "rename_workflow":
            if not created_workflow_id:
                return {"error": "HIBA: Munkafolyamat ID hiányzik az átnevezéshez."}
            
            print(f"Renaming workflow {created_workflow_id} to {step['new_name']}")
            
            # 1. Lekérjük a meglévő munkafolyamatot, hogy megkapjuk a nodes és connections-t
            existing_workflow_response = call_n8n_api("GET", f"workflows/{created_workflow_id}")
            if "error" in existing_workflow_response:
                return {"error": f"Hiba a meglévő munkafolyamat lekérdezése során: {existing_workflow_response['error']}"}
            
            existing_nodes = existing_workflow_response.get('nodes', [])
            existing_connections = existing_workflow_response.get('connections', {})
            existing_settings = existing_workflow_response.get('settings', {}) # Settings is also required
            
            # API hívás munkafolyamat átnevezéséhez (PUT)
            update_data = {
                "name": step['new_name'],
                "nodes": existing_nodes,
                "connections": existing_connections,
                "settings": existing_settings # Include existing settings
            }
            response = call_n8n_api("PUT", f"workflows/{created_workflow_id}", update_data)
            
            if "error" in response:
                return {"error": f"Hiba a munkafolyamat átnevezése során: {response['error']}"}
            
            created_workflow_name = response.get('name')
            print(f"Workflow renamed to: {created_workflow_name}")
        
        else:
            print(f"WARNING: Unknown action type or API equivalent not implemented: {step['action']}")

    print("Scenario execution complete via API.")
    return {"workflow_name": created_workflow_name, "workflow_id": created_workflow_id} if created_workflow_name else {"result": "Scenario execution complete. No workflow name verified."}


async def run_n8n_scenario_ui(scenario_path: str):
    """
    Browser-Use mód: Gemini + UI interakció (login, click, rename, save).
    Környezet: N8N_TEST_USER, N8N_TEST_PASSWORD, GOOGLE_API_KEY
    """
    try:
        from browser_use import Agent, ChatGoogle
    except ImportError:
        print("HIBA: browser-use nincs telepítve. Futtasd: pip install browser-use")
        return {"error": "browser-use not installed"}

    with open(scenario_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    test_user = os.getenv("N8N_TEST_USER")
    test_pass = os.getenv("N8N_TEST_PASSWORD")
    if not test_user or not test_pass:
        print("HIBA: N8N_TEST_USER vagy N8N_TEST_PASSWORD hiányzik a .env fájlból!")
        return {"error": "N8N credentials missing"}

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("HIBA: GOOGLE_API_KEY vagy GEMINI_API_KEY hiányzik a .env fájlból (Gemini használatához)!")
        return {"error": "GOOGLE_API_KEY or GEMINI_API_KEY missing"}
    # browser-use ChatGoogle GOOGLE_API_KEY-t vár
    if not os.getenv("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = api_key

    steps_desc = "\n".join(
        f"{i+1}. {s.get('description', s.get('action', ''))}"
        for i, s in enumerate(config.get("steps", []))
    )

    task = f"""
Menj a következő oldalra: {config.get('target_url', 'http://localhost:5678')}

Végezd el a következő lépéseket:
{steps_desc}

Belépési adatok: felhasználó = {test_user}, jelszó = {test_pass}

FONTOS: Ha a belépés után bármilyen felugró ablak/modal jelenik meg (pl. onboarding: milyen területen dolgozol, preferenciák stb.),
először azt zárd be vagy válaszd ki egy opciót (Skip, Close, Other, stb.), majd folytasd a fő feladattal.
Ne hagyd a böngészőt bezáródni – mindig kezeld a felugró ablakokat, mielőtt továbblépnél.

A végén igazold vissza a workflow nevét vagy a sikeres mentés megerősítését.
"""

    llm = ChatGoogle(model="gemini-2.0-flash")
    agent = Agent(task=task, llm=llm)
    result = await agent.run()
    return result


async def run_structured_extraction(config: dict, schema_source: str):
    """
    Browser-Use strukturált adatkinyerés:
    - JSON séma alapján kinyeri az adatot
    - Pydantic validáció után JSON-t ad vissza
    """
    try:
        from browser_use import Agent, ChatGoogle
    except ImportError:
        print("HIBA: browser-use nincs telepítve. Futtasd: pip install browser-use")
        return {"error": "browser-use not installed"}

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("HIBA: GOOGLE_API_KEY vagy GEMINI_API_KEY hiányzik a .env fájlból (Gemini használatához)!")
        return {"error": "GOOGLE_API_KEY or GEMINI_API_KEY missing"}
    if not os.getenv("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = api_key

    schema = _load_schema_source(schema_source)
    schema_name = schema.get("title", "DynamicExtraction")
    steps_desc = "\n".join(
        f"{i+1}. {s.get('description', s.get('action', ''))}"
        for i, s in enumerate(config.get("steps", []))
    )

    extraction_prompt = config.get(
        "extraction_prompt",
        "Gyűjtsd ki a szükséges adatokat a megadott JSON séma szerint."
    )
    target_url = config.get("target_url", "http://localhost:5678")

    task = f"""
Menj a következő oldalra: {target_url}

{steps_desc if steps_desc else ""}

Feladat: {extraction_prompt}

STRICT JSON OUTPUT:
Adj vissza CSAK valid JSON-t a következő séma szerint, semmi mást.
Séma:
{json.dumps(schema, ensure_ascii=False)}
"""

    llm = ChatGoogle(model=config.get("model", "gemini-2.0-flash"))
    agent = Agent(task=task, llm=llm)
    raw_result = await agent.run()
    raw_text = raw_result if isinstance(raw_result, str) else json.dumps(raw_result, ensure_ascii=False)
    json_blob = _extract_json_blob(raw_text)
    if not json_blob:
        return {"error": "No JSON found in model output", "raw_output": raw_text}

    try:
        parsed = json.loads(json_blob)
        validated = validate_with_schema(schema, parsed, name=schema_name)
        return {"data": validated, "raw_output": raw_text}
    except (json.JSONDecodeError, ValidationError) as e:
        return {"error": f"Validation failed: {e}", "raw_output": raw_text}


async def run_scenario(scenario_path: str, force_mode: str | None = None):
    """
    Scenario futtatása – automatikus módválasztás vagy force_mode ('api'|'ui').
    """
    with open(scenario_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    if _is_extraction_scenario(config):
        schema_source = config.get("extraction_schema") or ""
        if not schema_source:
            return {"error": "Missing extraction_schema in scenario config."}
        return await run_structured_extraction(config, schema_source)

    use_ui = force_mode == "ui" or (force_mode is None and _is_ui_scenario(config))

    if use_ui:
        return await run_n8n_scenario_ui(scenario_path)
    return await run_n8n_api_scenario(scenario_path)


def check_setup(scenario_path: str) -> bool:
    """
    Ellenőrzi a beállításokat API kulcs nélkül. --check mód.
    Returns True ha minden rendben, False ha hiányzik valami.
    """
    ok = True
    if not os.path.exists(scenario_path):
        print(f"HIBA: Scenario nem található: {scenario_path}")
        return False

    with open(scenario_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    if _is_extraction_scenario(config):
        if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
            print("FIGYELEM: GOOGLE_API_KEY vagy GEMINI_API_KEY hiányzik - strukturált kinyeréshez szükséges")
            ok = False
        if not config.get("extraction_schema"):
            print("FIGYELEM: extraction_schema hiányzik a scenario fájlból")
            ok = False
        if ok:
            print("OK: Strukturált kinyerés mód - minden beállítás megvan")
        print(f"Scenario: {config.get('scenario_name', '?')} (structured extraction)")
        return ok

    use_ui = _is_ui_scenario(config)

    if use_ui:
        try:
            from browser_use import Agent, ChatGoogle  # noqa: F401
        except ImportError:
            print("HIBA: browser-use nincs telepítve. Futtasd: pip install browser-use")
            return False

        if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
            print("FIGYELEM: GOOGLE_API_KEY vagy GEMINI_API_KEY hiányzik - add hozzá a .env-hez a UI teszthez")
            ok = False
        if not os.getenv("N8N_TEST_USER") or not os.getenv("N8N_TEST_PASSWORD"):
            print("FIGYELEM: N8N_TEST_USER vagy N8N_TEST_PASSWORD hiányzik")
            ok = False
        if ok:
            print("OK: Browser-Use UI mód - minden környezeti változó megvan")
    else:
        if not os.getenv("N8N_API_KEY") or not os.getenv("N8N_TEST_URL"):
            print("FIGYELEM: N8N_API_KEY vagy N8N_TEST_URL hiányzik az API módhoz")
            ok = False
        else:
            print("OK: API mód - minden környezeti változó megvan")

    print(f"Scenario: {config.get('scenario_name', '?')} ({len(config.get('steps', []))} lépés)")
    return ok


if __name__ == "__main__":
    import sys
    def _arg_value(args: list[str], key: str) -> Optional[str]:
        if key in args:
            idx = args.index(key)
            if idx + 1 < len(args):
                return args[idx + 1]
        return None

    if "--extract" in sys.argv:
        schema_source = _arg_value(sys.argv, "--schema")
        url = _arg_value(sys.argv, "--url") or "http://localhost:5678"
        prompt = _arg_value(sys.argv, "--prompt") or "Gyűjtsd ki a szükséges adatokat."
        if not schema_source:
            print("HIBA: --schema paraméter kötelező --extract módhoz.")
            sys.exit(1)
        cfg = {"target_url": url, "extraction_prompt": prompt}
        asyncio.run(run_structured_extraction(cfg, schema_source))
        sys.exit(0)
    if "--check" in sys.argv:
        sys.argv.remove("--check")
        scenario = sys.argv[1] if len(sys.argv) > 1 else "myai/scenarios/n8n_training_ui.json"
        exit(0 if check_setup(scenario) else 1)

    scenario = sys.argv[1] if len(sys.argv) > 1 else "myai/scenarios/n8n_training.json"
    mode = None
    for arg in sys.argv[2:]:
        if arg in ("ui", "api"):
            mode = arg
            break
    asyncio.run(run_scenario(scenario, force_mode=mode))