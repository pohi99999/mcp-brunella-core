"""
Robotkéz Pro — Szekvenciális Tréning Suite
===========================================
Nem véletlen feladatsorrendet, hanem fokozatosan nehezedő, egymásra épülő
feladatokat tartalmaz. A rendszer megjegyzi a sikereket és kudarcokat, és
a következő ciklusban már ezekből tanul (main.py-on keresztül).

Indítás: python training_suite.py
(Külön terminálban, miközben a main.py fut: uvicorn myai.robotkez_pro.main:app --port 8090)
"""

import time
import json
import requests
import datetime
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------
# KONFIGURÁCIÓ
# ---------------------------------------------------------------------

API_URL = "http://localhost:8090"
N8N_URL = "http://localhost:5678"
LANGFLOW_URL = "http://localhost:7860"
MEMORY_PATH = Path("data/robotkez_memory.json")

# Szekvenciális feladatsor — az egyszerűtől a bonyolult felé
# Minden feladat az előzőre épül
TRAINING_TASKS = [
    # --- 1. Szint: Alapnavigáció ---
    f"Navigálj az n8n felületére: {N8N_URL} és ellenőrizd, hogy betöltött.",
    f"Navigálj az n8n felületére: {N8N_URL} és kattints az 'Add Workflow' gombra.",

    # --- 2. Szint: n8n node kezelés ---
    "Keress egy 'HTTP Request' node-ot az n8n-ben és húzd be a vászonra.",
    "Nyisd meg a HTTP Request node-ot és írd be az URL mezőbe: https://api.google.com",

    # --- 3. Szint: Langflow alapok ---
    f"Menj a Langflow-ra: {LANGFLOW_URL} és próbálj meg elhelyezni egy 'OpenAI' modult.",
    "Köss össze két tetszőleges dobozt a Langflow vásznán.",

    # --- 4. Szint: Computer Use (OS szint) ---
    "Kattints a Windows tálcán a Start menüre (Computer Use teszt).",
    "Nyiss meg egy Jegyzettömböt (Notepad) és írd bele: 'Brunella Robotkez Pro Teszt SIKERES'",

    # --- 5. Szint: Kombinált feladatok ---
    f"Nyiss egy új böngésző fület és navigálj az n8n-re: {N8N_URL}/workflow/new",
    "Az n8n-ben add hozzá az összes alapvető node-ot: HTTP Request, Set, IF, Code.",
]

# n8n Workflow Auto-Builder feladatok — a Comet Orchestrator-ral futnak
N8N_WORKFLOW_TASKS = [
    # --- A. Lead Mining pipeline ---
    {
        "name": "Lead Mining Workflow",
        "task": (
            "Építs egy n8n workflow-t a következőkkel: "
            "1) Manuális trigger (Execute Workflow Manually) node. "
            "2) HTTP Request node — GET https://api.apollo.io/v1/people/search. "
            "3) Set node — állítsd be a 'leads' mezőt az eredményből. "
            "4) Google Sheets node (vagy Set) — szimulálj egy kimeneti node-ot. "
            "Kösd össze őket sorban és mentsd el a workflow-t 'Lead Mining Pipeline' néven."
        ),
    },
    # --- B. Invoice processzáló ---
    {
        "name": "Invoice Processing Workflow",
        "task": (
            "Építs egy n8n workflow-t: "
            "1) Webhook trigger node (POST /invoice). "
            "2) IF node — ellenőrizd, hogy van-e 'amount' mező. "
            "3) HTTP Request node (igaz ág) — POST a feldolgozáshoz. "
            "4) Code node (hamis ág) — logold az 'Érvénytelen számla' üzenetet. "
            "Kösd össze a node-okat és mentsd el 'Invoice Processor' néven."
        ),
    },
    # --- C. Market Watcher ---
    {
        "name": "Market Watcher Workflow",
        "task": (
            "Építs egy n8n workflow-t: "
            "1) Schedule trigger node (minden 1 óra). "
            "2) HTTP Request node — GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd. "
            "3) IF node — ellenőrizd, hogy az ár > 50000. "
            "4) Set node — formázd a riasztási üzenetet. "
            "Kösd össze sorban és mentsd el 'Market Watcher' néven."
        ),
    },
]

# ---------------------------------------------------------------------
# STATISZTIKA
# ---------------------------------------------------------------------

class TrainingStats:
    def __init__(self):
        self.results: list[dict] = []
        self.start_time = datetime.datetime.now()

    def record(self, task: str, success: bool, reason: str = "", duration_s: float = 0):
        self.results.append({
            "task": task[:60] + "..." if len(task) > 60 else task,
            "success": success,
            "reason": reason,
            "duration_s": round(duration_s, 1),
            "time": datetime.datetime.now().strftime("%H:%M:%S")
        })

    def summary(self) -> str:
        total = len(self.results)
        success = sum(1 for r in self.results if r["success"])
        elapsed = (datetime.datetime.now() - self.start_time).seconds // 60
        lines = [
            f"\n{'='*60}",
            f"📊 TRÉNING STATISZTIKA",
            f"{'='*60}",
            f"Összes kísérlet: {total}",
            f"Sikeres: {success} ({success*100//total if total else 0}%)",
            f"Hibás: {total - success}",
            f"Eltelt idő: {elapsed} perc",
            f"{'='*60}",
        ]
        for r in self.results[-10:]:  # utolsó 10
            icon = "✅" if r["success"] else "❌"
            lines.append(f"{icon} [{r['time']}] {r['task']} ({r['duration_s']}s)")
        return "\n".join(lines)

# ---------------------------------------------------------------------
# MEMÓRIA BETÖLTŐ
# ---------------------------------------------------------------------

def load_current_memory() -> dict:
    try:
        with open(MEMORY_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"solutions": {}, "errors": {}}

def get_task_success_rate(task: str) -> Optional[float]:
    """Visszaadja a feladat eddigi sikerességi arányát (0.0-1.0) a memória alapján."""
    memory = load_current_memory()
    key = task[:80]
    solutions = memory.get("solutions", {}).get(key, [])
    if not solutions:
        return None
    success_count = sum(1 for s in solutions if s.get("success", False))
    return success_count / len(solutions)

# ---------------------------------------------------------------------
# EGYSÉGES API HÍVÁS RETRY-JAL
# ---------------------------------------------------------------------

def call_computer_use(task: str, timeout: int = 120) -> dict:
    """Meghívja a Robotkéz Pro /computer_use végpontját és visszaadja az eredményt."""
    try:
        response = requests.post(
            f"{API_URL}/computer_use",
            params={"task": task},
            timeout=timeout
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        return {"status": "error", "error": "Időtúllépés (120s)"}
    except requests.exceptions.ConnectionError:
        return {"status": "error", "error": "Szerver nem elérhető (Connection refused)"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def call_computer_use_auto(task: str, max_retries: int = 3, timeout: int = 300) -> dict:
    """Meghívja a Comet Orchestrator /computer_use_auto végpontját (autonóm multi-step)."""
    try:
        response = requests.post(
            f"{API_URL}/computer_use_auto",
            params={"task": task, "max_retries": max_retries},
            timeout=timeout
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        return {"status": "error", "error": f"Időtúllépés ({timeout}s)"}
    except requests.exceptions.ConnectionError:
        return {"status": "error", "error": "Szerver nem elérhető (Connection refused)"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# ---------------------------------------------------------------------
# EGY FELADAT FUTTATÁSA (max_retries-szal)
# ---------------------------------------------------------------------

def run_task(task: str, max_retries: int = 3, pause_between_s: int = 5) -> bool:
    """
    Futtat egy feladatot, legfeljebb max_retries-szor újrapróbálja.
    Visszatér True-val ha sikeres, False-szal ha minden kísérlet kudarcot val.
    """
    for attempt in range(1, max_retries + 1):
        print(f"\n  🔄 [{attempt}/{max_retries}] Próbálkozás...")
        start = time.time()
        result = call_computer_use(task)
        duration = time.time() - start

        if result.get("status") == "success":
            action_info = result.get("last_action", {})
            print(f"  ✅ SIKER ({duration:.1f}s) — Akció: {action_info.get('action', '?')}")
            print(f"     Ok: {action_info.get('reason', '')[:80]}")
            return True
        else:
            error = result.get("error") or result.get("last_action", {}).get("exec", {}).get("error", "ismeretlen hiba")
            print(f"  ❌ Hiba: {error[:100]}")
            if attempt < max_retries:
                print(f"  ⏳ {pause_between_s}s várakozás újrapróbálás előtt...")
                time.sleep(pause_between_s)

    return False

# ---------------------------------------------------------------------
# FŐ TRÉNING HUROK
# ---------------------------------------------------------------------

def run_training_loop(duration_hours: float = 4.0, max_retries_per_task: int = 3):
    end_time = time.time() + (duration_hours * 3600)
    stats = TrainingStats()

    print(f"\n{'='*60}")
    print(f"🚀 ROBOTKÉZ PRO — TRÉNING INDUL")
    print(f"{'='*60}")
    print(f"⏱  Időtartam: {duration_hours} óra")
    print(f"🔄 Max újrapróbálkozás/feladat: {max_retries_per_task}")
    print(f"📋 Feladatszám: {len(TRAINING_TASKS)}")
    print(f"⏰ Kezdés: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    # Böngésző indítása
    print("\n📀 Böngésző inicializálása...")
    try:
        r = requests.post(f"{API_URL}/start_browser", timeout=30)
        if r.status_code == 200:
            print("✅ Böngésző elindítva.")
        else:
            print(f"⚠️  start_browser visszatérési kód: {r.status_code}")
    except Exception as e:
        print(f"❌ Böngésző indítási hiba: {e}")
        print("   Ellenőrizd, hogy fut-e a main.py (port 8090)")
        return

    # Életkép ellenőrzés
    try:
        requests.get(f"{API_URL}/health", timeout=5)
        print("✅ Action Server elérhető.")
    except Exception:
        print("❌ Action Server nem elérhető! Megszakítás.")
        return

    cycle = 1
    task_index = 0

    while time.time() < end_time:
        # Feladat kiválasztása szekvenciálisan, körkörös ismétléssel
        task = TRAINING_TASKS[task_index % len(TRAINING_TASKS)]
        task_index += 1

        # Meglévő sikerességi arány megjelenítése
        success_rate = get_task_success_rate(task)
        rate_str = f" [{success_rate*100:.0f}% eddigi arány]" if success_rate is not None else " [első próba]"

        print(f"\n[Ciklus {cycle}]{rate_str}")
        print(f"📌 Feladat: {task[:70]}...")

        start = time.time()
        success = run_task(task, max_retries=max_retries_per_task, pause_between_s=3)
        duration = time.time() - start

        if success:
            stats.record(task, True, "Sikeresen végrehajtva", duration)
        else:
            stats.record(task, False, f"Minden kísérlet kudarcot vallott", duration)
            print(f"  💡 Tipp: Ellenőrizd a memóriát a /memory endpointon")

        # Statisztika 10 ciklusonként
        if cycle % 10 == 0:
            print(stats.summary())
            remaining_min = (end_time - time.time()) / 60
            print(f"\n⏳ Hátralévő idő: {remaining_min:.0f} perc")

        cycle += 1
        time.sleep(4)  # rövid szünet feladatok között

    # Végső statisztika
    print(stats.summary())
    print(f"\n🏁 TRÉNING BEFEJEZVE: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Memória állapot lekérdezése
    try:
        mem_response = requests.get(f"{API_URL}/memory", timeout=5).json()
        print(f"\n🧠 Memória állapot:")
        print(f"   Megtanult feladatok: {mem_response.get('total_tasks_learned', 0)}")
        print(f"   Hibás feladatok: {mem_response.get('total_tasks_failed', 0)}")
    except Exception:
        pass

# ---------------------------------------------------------------------
# n8n WORKFLOW AUTO-BUILDER
# ---------------------------------------------------------------------

def run_workflow_builder(max_retries: int = 3):
    """Futtatja az n8n workflow auto-builder feladatokat a Comet Orchestrator-ral."""
    stats = TrainingStats()

    print(f"\n{'='*60}")
    print(f"🏗️  n8n WORKFLOW AUTO-BUILDER INDUL")
    print(f"{'='*60}")
    print(f"📋 Workflow feladatok: {len(N8N_WORKFLOW_TASKS)}")
    print(f"🔄 Max próbálkozás: {max_retries}")
    print(f"⏰ Kezdés: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    # Létcheck
    try:
        requests.get(f"{API_URL}/health", timeout=5)
        print("✅ Action Server elérhető.")
    except Exception:
        print("❌ Action Server nem elérhető! Ellenőrizd: uvicorn myai.robotkez_pro.main:app --port 8090")
        return

    for idx, wf in enumerate(N8N_WORKFLOW_TASKS, 1):
        name = wf["name"]
        task = wf["task"]

        print(f"\n{'='*60}")
        print(f"🏗️  [{idx}/{len(N8N_WORKFLOW_TASKS)}] {name}")
        print(f"{'='*60}")
        print(f"📌 {task[:100]}...")

        start = time.time()
        result = call_computer_use_auto(task, max_retries=max_retries, timeout=600)
        duration = time.time() - start

        comet = result.get("comet_result", {})
        if comet.get("success"):
            print(f"  ✅ SIKER — {comet.get('steps_completed', 0)} lépés, {comet.get('attempts', 1)} próba ({duration:.0f}s)")
            stats.record(name, True, "Sikeresen felépítve", duration)
        else:
            error = comet.get("error") or result.get("error", "ismeretlen hiba")
            print(f"  ❌ HIBA: {error}")
            stats.record(name, False, error, duration)

        # Szünet workflowk között
        time.sleep(5)

    print(stats.summary())
    print(f"\n🏁 WORKFLOW BUILDER BEFEJEZVE: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# ---------------------------------------------------------------------
# BELÉPÉSI PONT
# ---------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Robotkéz Pro Training Suite")
    parser.add_argument("--hours", type=float, default=4.0, help="Tréning időtartama órákban (alapértelmezett: 4)")
    parser.add_argument("--retries", type=int, default=3, help="Max újrapróbálkozás feladatonként (alapértelmezett: 3)")
    parser.add_argument("--workflows", action="store_true", help="n8n Workflow Auto-Builder mód (Comet Orchestrator-ral)")
    args = parser.parse_args()

    if args.workflows:
        run_workflow_builder(max_retries=args.retries)
    else:
        run_training_loop(duration_hours=args.hours, max_retries_per_task=args.retries)
