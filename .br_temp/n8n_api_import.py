"""
Iszapfaló n8n Import & Felügyeleti Szkript
Használat: python _br_temp/n8n_api_import.py --api-key YOUR_KEY [--check|--import|--status]

Az API key megszerzése:
1. Lépj be az n8n-be: https://iszapfalo.app.n8n.cloud
2. Jobb felső sarok → Settings → API → Create API Key
3. Másold ki és add meg --api-key paraméterként
"""
import asyncio
import argparse
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

N8N_BASE = "https://iszapfalo.app.n8n.cloud/api/v1"
IMPORT_READY_DIR = Path("F:/mcp-brunella-core/docs/Egyéb/Iszapfull_nyilvan/IMPORT_READY_PACK_2026_03_13")

# Importálási sorrend a MANIFEST szerint
IMPORT_ORDER = [
    "02_ai_agent_asszisztens_v2_javitott.json",
    "06_telegram_parancsok_statusz_het.json", 
    "05_heti_emlekezteto_csutortok_1600.json",
    "04_google_calendar_airtable_szinkron.json",
    "03_airtable_google_calendar_feladat_keszito.json",
    "01_feladat_status_telegram_chat.json",
    "07_telegram_hangvezerles_teljes_rendszer.json",
    # "08_kimeno_ajanlatok_dokumentumok.json",  # BEFEJEZETLEN - kihagyjuk!
]


def n8n_request(method: str, path: str, api_key: str, body=None):
    """n8n API hívás helper"""
    url = f"{N8N_BASE}{path}"
    headers = {
        "X-N8N-API-KEY": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"   HTTP {e.code}: {error_body[:200]}")
        return None


def check_workflows(api_key: str):
    """Lekéri az n8n-ben lévő összes workflow-t"""
    print("\n📋 JELENLEGI N8N WORKFLOW-K LEKÉRÉSE...")
    result = n8n_request("GET", "/workflows?limit=100", api_key)
    if not result:
        print("❌ Nem sikerült lekérni a workflow-kat. Ellenőrizd az API key-t!")
        return []
    
    workflows = result.get("data", [])
    print(f"\n✅ Összesen {len(workflows)} workflow az n8n-ben:\n")
    print(f"{'#':>3} | {'ID':^25} | {'Aktív':^6} | {'Név'}")
    print("-" * 80)
    for i, wf in enumerate(workflows, 1):
        active = "🟢 DA" if wf.get("active") else "⚫ nem"
        name = wf.get("name", "???")[:45]
        wf_id = wf.get("id", "???")[:25]
        print(f"{i:>3} | {wf_id:^25} | {active:^8} | {name}")
    
    return workflows


def import_workflows(api_key: str, dry_run: bool = False):
    """Importálja az IMPORT_READY_PACK workflow-kat az n8n-be"""
    print("\n🚀 IMPORT_READY_PACK IMPORTÁLÁSA...")
    
    if not IMPORT_READY_DIR.exists():
        print(f"❌ Import könyvtár nem található: {IMPORT_READY_DIR}")
        return
    
    # Meglévő workflow-k lekérése (duplicate elkerülés)
    existing = check_workflows(api_key)
    existing_names = {wf["name"].lower().strip() for wf in existing}
    
    print(f"\n{'DRY-RUN MÓD - nem importál ténylegesen!' if dry_run else 'VALÓS IMPORT MÓD'}")
    print("-" * 60)
    
    for filename in IMPORT_ORDER:
        filepath = IMPORT_READY_DIR / filename
        if not filepath.exists():
            print(f"⚠️  Nem található: {filename}")
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            wf_data = json.load(f)
        
        wf_name = wf_data.get("name", filename)
        
        # Duplikátum ellenőrzés
        if wf_name.lower().strip() in existing_names:
            print(f"⏭️  MÁR LÉTEZIK: {wf_name}")
            continue
        
        print(f"📥 Import: {wf_name[:60]}...")
        
        if dry_run:
            print(f"   [DRY-RUN] Importálnám: {filename}")
            print(f"   Nodes: {len(wf_data.get('nodes', []))}")
            continue
        
        # Az n8n import API payload
        import_payload = {
            "name": wf_data.get("name"),
            "nodes": wf_data.get("nodes", []),
            "connections": wf_data.get("connections", {}),
            "settings": wf_data.get("settings", {}),
            "staticData": wf_data.get("staticData"),
        }
        
        result = n8n_request("POST", "/workflows", api_key, import_payload)
        if result and result.get("id"):
            new_id = result["id"]
            print(f"   ✅ Importálva! ID: {new_id}")
            # Elmentjük az ID-t
            with open("_br_temp/imported_ids.json", "a", encoding="utf-8") as f:
                json.dump({"file": filename, "name": wf_name, "id": new_id}, f)
                f.write("\n")
        else:
            print(f"   ❌ Import SIKERTELEN: {filename}")


def activate_workflow(api_key: str, workflow_id: str):
    """Aktivál egy workflow-t ID alapján"""
    print(f"\n▶️  Workflow aktiválása: {workflow_id}")
    result = n8n_request("PATCH", f"/workflows/{workflow_id}", api_key, {"active": True})
    if result:
        print(f"   ✅ Aktiválva: {result.get('name', '???')}")
    else:
        print(f"   ❌ Aktiválás sikertelen")


def okos_ajanlo_activate(api_key: str):
    """Megkeresi és aktiválja az Okos Ajánlato Asszisztens-t (ID: 2OD30EyzBAdbMmLa)"""
    wf_id = "2OD30EyzBAdbMmLa"
    print(f"\n🧠 Okos Ajánlat aktiválása (ID: {wf_id})...")
    result = n8n_request("PATCH", f"/workflows/{wf_id}", api_key, {"active": True})
    if result:
        print(f"   ✅ Aktiválva! Neve: {result.get('name', '???')}")
        print(f"   Webhook: POST https://iszapfalo.app.n8n.cloud/webhook/okos-ajanlatado-v2")
    else:
        print(f"   ❌ Sikertelen. Lehet hogy más projektben van, vagy már törölték.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Iszapfaló n8n Import Tool")
    parser.add_argument("--api-key", required=True, help="n8n API Key (Settings → API)")
    parser.add_argument("--check", action="store_true", help="Csak listázza a workflow-kat")
    parser.add_argument("--import", action="store_true", dest="do_import", help="Importálja az IMPORT_READY_PACK-ot")
    parser.add_argument("--dry-run", action="store_true", help="Csak szimulálja az importot")
    parser.add_argument("--okos-ajanlo", action="store_true", help="Aktiválja az Okos Ajánlat workflow-t")
    parser.add_argument("--activate", help="Workflow ID aktiválása")
    
    args = parser.parse_args()
    
    if args.check:
        check_workflows(args.api_key)
    
    if args.do_import or args.dry_run:
        import_workflows(args.api_key, dry_run=args.dry_run)
    
    if args.okos_ajanlo:
        okos_ajanlo_activate(args.api_key)
    
    if args.activate:
        activate_workflow(args.api_key, args.activate)
    
    if not any([args.check, args.do_import, args.dry_run, args.okos_ajanlo, args.activate]):
        print("\n⚡ GYORS TESZT - API KEY ELLENŐRZÉS:")
        workflows = check_workflows(args.api_key)
        if workflows:
            print(f"\n✅ API KEY ÉRVÉNYES! {len(workflows)} workflow megtalálva.")
        else:
            print("\n❌ Ellenőrizd az API key-t!")
        
        print("\nHasználat:")
        print("  --check          → workflow lista")
        print("  --dry-run        → Mi lenne importálva?")
        print("  --import         → Ténylegesen importál")
        print("  --okos-ajanlo    → Okos Ajánlat aktiválása")
