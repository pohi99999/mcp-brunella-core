import os
import sys
import json
import base64
import asyncio
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from playwright.async_api import async_playwright
from openai import OpenAI
import pyautogui
import httpx

# Comet Orchestrator import (a parent package-ből)
sys.path.insert(0, str(Path(__file__).parent.parent))
from agents.comet.orchestrator import CometOrchestrator

app = FastAPI(title="Robotkez Pro - Windows & Browser Control")

# Node.js szerver URL (Socket.IO step event proxy)
NODE_API = os.getenv("NODE_API_URL", "http://localhost:3000")

# ---------------------------------------------------------------------
# CONFIG & PATHS
# ---------------------------------------------------------------------

MEMORY_PATH = Path("data/robotkez_memory.json")
ANCHORS_PATH = Path(__file__).parent.parent / "robotkez" / "n8n_anchors.json"

# ---------------------------------------------------------------------
# AI CLIENT
# ---------------------------------------------------------------------

def get_ai_client() -> OpenAI:
    github_pat = os.getenv("GITHUB_PAT")
    openai_key = os.getenv("OPENAI_API_KEY")
    if github_pat:
        return OpenAI(base_url="https://models.inference.ai.azure.com", api_key=github_pat)
    if openai_key:
        return OpenAI(api_key=openai_key)
    raise RuntimeError("No AI API key found. Set GITHUB_PAT or OPENAI_API_KEY in .env")

# ---------------------------------------------------------------------
# MEMORY
# ---------------------------------------------------------------------

def load_memory() -> dict:
    try:
        with open(MEMORY_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"solutions": {}, "errors": {}}

def save_to_memory(task_key: str, action_data: dict, success: bool) -> None:
    memory = load_memory()
    key = task_key[:80]
    bucket = "solutions" if success else "errors"
    if key not in memory[bucket]:
        memory[bucket][key] = []
    memory[bucket][key].append(action_data)
    # Keep last 10 entries per task
    memory[bucket][key] = memory[bucket][key][-10:]
    MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MEMORY_PATH, "w", encoding="utf-8") as f:
        json.dump(memory, f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------------
# VISUAL ANCHORS
# ---------------------------------------------------------------------

def load_anchors() -> dict:
    try:
        with open(ANCHORS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

# ---------------------------------------------------------------------
# STATE & BROWSER MANAGER
# ---------------------------------------------------------------------

class State:
    def __init__(self):
        self.pw = None
        self.browser = None
        self.context = None
        self.page = None

state = State()

class BrowserManager:
    async def start(self):
        try:
            if not state.browser:
                print("🚀 Initializing Playwright...")
                state.pw = await async_playwright().start()
                state.browser = await state.pw.chromium.launch(
                    headless=False,
                    slow_mo=80,
                    args=["--start-maximized"]
                )
                state.context = await state.browser.new_context(no_viewport=True)
                state.page = await state.context.new_page()
                await state.page.goto("https://www.google.com")
                print("✅ Browser started.")
        except Exception as e:
            print(f"❌ Error starting browser: {e}")
            state.browser = None
            raise e

    async def ensure_active(self):
        try:
            if not state.browser or not state.page:
                await self.start()
            else:
                await state.page.title()
        except Exception:
            print("🔄 Browser lost, restarting...")
            state.browser = None
            await self.start()

browser_manager = BrowserManager()

# ---------------------------------------------------------------------
# ACTION EXECUTOR
# ---------------------------------------------------------------------

async def execute_action(action: str, params: dict) -> dict:
    """Execute a single browser/OS action and return result."""
    try:
        if action == "navigate":
            url = params.get("url", "")
            if not url.startswith("http"):
                url = "https://" + url
            await state.page.goto(url, wait_until="domcontentloaded", timeout=15000)
            return {"status": "success", "action": action, "url": url}

        elif action == "click":
            x, y = int(params.get("x", 0)), int(params.get("y", 0))
            await state.page.mouse.click(x, y)
            return {"status": "success", "action": action, "x": x, "y": y}

        elif action == "click_os":
            # Native OS-level click via pyautogui
            x, y = int(params.get("x", 0)), int(params.get("y", 0))
            pyautogui.click(x=x, y=y)
            return {"status": "success", "action": action, "x": x, "y": y}

        elif action == "type":
            text = params.get("text", "")
            await state.page.keyboard.type(text, delay=50)
            if params.get("press_enter"):
                await state.page.keyboard.press("Enter")
            return {"status": "success", "action": action, "text": text}

        elif action == "press_key":
            key = params.get("key", "Enter")
            await state.page.keyboard.press(key)
            return {"status": "success", "action": action, "key": key}

        elif action == "scroll":
            amount = int(params.get("amount", -300))
            await state.page.mouse.wheel(0, amount)
            return {"status": "success", "action": action, "amount": amount}

        elif action == "wait":
            seconds = float(params.get("seconds", 2))
            await asyncio.sleep(min(seconds, 10))
            return {"status": "success", "action": action, "seconds": seconds}

        elif action == "screenshot":
            # Just take a screenshot, no further action
            return {"status": "success", "action": action}

        else:
            return {"status": "error", "action": action, "error": f"Unknown action: {action}"}

    except Exception as e:
        return {"status": "error", "action": action, "error": str(e)}

# ---------------------------------------------------------------------
# VISION AI: GPT-4o döntéshozó
# ---------------------------------------------------------------------

async def ask_vision_ai(task: str, screenshot_b64: str, past_solutions: list) -> dict:
    """Send screenshot + task to GPT-4o vision and return structured action."""
    anchors = load_anchors()
    memory = load_memory()
    general_knowledge = memory.get("general_knowledge", {})
    known_errors = list(memory.get("errors", {}).values())[:3]
    client = get_ai_client()

    system_prompt = (
        "Te egy precíz Windows és böngésző automatizációs ügynök vagy (Robotkéz Pro). "
        "Magyar utasításokat hajtasz végre. "
        "Mindig JSON-t adj vissza a megadott sémával. "
        "Ha nincs tennivaló vagy a feladat kész, action='wait'-et adj vissza."
    )

    user_prompt = (
        f"FELADAT: {task}\n\n"
        f"ÁLTALÁNOS TUDÁSBÁZIS (URL-ek, billentyűkombinációk, UI tippek):\n"
        f"{json.dumps(general_knowledge, ensure_ascii=False)}\n\n"
        f"ISMERT UI ELEMEK (n8n/Langflow anchors):\n"
        f"{json.dumps(anchors, ensure_ascii=False)}\n\n"
        f"KERÜLENDŐ HIBAMINTÁK:\n{json.dumps(known_errors, ensure_ascii=False)}\n\n"
        f"KORÁBBI SIKERES LÉPÉSEK EHHEZ A FELADATHOZ:\n{json.dumps(past_solutions[-3:], ensure_ascii=False)}\n\n"
        "Elemezd a képernyőképet és add meg a KÖVETKEZŐ EGY lépést JSON formátumban:\n"
        "{\n"
        '  "action": "navigate|click|type|press_key|scroll|wait|click_os",\n'
        '  "reason": "miért pontosan ezt teszed",\n'
        '  "params": {\n'
        '    "url": "<string>",     // navigate esetén\n'
        '    "x": <int>,            // click/click_os esetén (képernyő px)\n'
        '    "y": <int>,            // click/click_os esetén (képernyő px)\n'
        '    "text": "<string>",    // type esetén\n'
        '    "press_enter": false,  // type esetén\n'
        '    "key": "<string>",     // press_key esetén (pl. "Enter", "Tab")\n'
        '    "amount": <int>,       // scroll esetén (negatív = le)\n'
        '    "seconds": <float>     // wait esetén\n'
        '  }\n'
        "}"
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{screenshot_b64}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ],
        max_tokens=600,
        temperature=0.1
    )

    raw = response.choices[0].message.content
    return json.loads(raw)

# ---------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "browser_active": state.browser is not None,
        "memory_entries": len(load_memory().get("solutions", {}))
    }

@app.post("/start_browser")
async def api_start_browser():
    await browser_manager.start()
    return {"status": "success"}

@app.post("/navigate")
async def navigate(url: str):
    await browser_manager.ensure_active()
    print(f"🌐 Navigating to: {url}")
    await state.page.goto(url, wait_until="domcontentloaded")
    return {"status": "success"}

@app.get("/screenshot")
async def get_screenshot():
    """Returns current page screenshot as base64 PNG."""
    await browser_manager.ensure_active()
    shot_bytes = await state.page.screenshot(full_page=False)
    return {
        "status": "success",
        "image": base64.b64encode(shot_bytes).decode(),
        "url": state.page.url
    }

@app.post("/computer_use")
async def computer_use(task: str):
    """
    AI-vezérelt böngésző/OS vezérlés GPT-4o Vision segítségével.
    1. Screenshot → 2. GPT-4o dönt → 3. Végrehajtás → 4. Memóriamentés
    """
    await browser_manager.ensure_active()

    # Betöltjük a memóriát
    memory = load_memory()
    past_solutions = memory.get("solutions", {}).get(task[:80], [])

    # Screenshot a jelenlegi állapotról
    shot_bytes = await state.page.screenshot(full_page=False)
    shot_b64 = base64.b64encode(shot_bytes).decode()

    print(f"🤖 GPT-4o elemzi: {task[:60]}...")

    try:
        action_data = await ask_vision_ai(task, shot_b64, past_solutions)
    except Exception as e:
        save_to_memory(task, {"error": str(e), "task": task}, success=False)
        raise HTTPException(status_code=500, detail=f"AI hiba: {e}")

    action = action_data.get("action", "wait")
    params = action_data.get("params", {})
    reason = action_data.get("reason", "")

    print(f"  ➜ Akció: {action} | Ok: {reason}")

    # Végrehajtás
    exec_result = await execute_action(action, params)

    # Mentés memóriába
    save_to_memory(task, {
        "action": action,
        "params": params,
        "reason": reason,
        "success": exec_result.get("status") == "success"
    }, success=exec_result.get("status") == "success")

    return {
        "status": exec_result.get("status", "error"),
        "last_action": {
            "action": action,
            "reason": reason,
            "params": params,
            "exec": exec_result
        }
    }

@app.get("/memory")
async def get_memory():
    """Returns the current training memory."""
    memory = load_memory()
    return {
        "total_tasks_learned": len(memory.get("solutions", {})),
        "total_tasks_failed": len(memory.get("errors", {})),
        "solutions": list(memory.get("solutions", {}).keys()),
        "errors": list(memory.get("errors", {}).keys())
    }

@app.delete("/memory")
async def clear_memory():
    """Clears the training memory (fresh start)."""
    MEMORY_PATH.write_text('{"solutions": {}, "errors": {}}', encoding="utf-8")
    return {"status": "cleared"}

# ---------------------------------------------------------------------
# COMET ORCHESTRATOR — Autonóm multi-step loop (Planner → Actor → Critic)
# ---------------------------------------------------------------------

comet_orchestrator = CometOrchestrator(headless=False)

@app.post("/computer_use_auto")
async def computer_use_auto(task: str, max_retries: int = 3):
    """
    Autonóm feladat-végrehajtás Comet Orchestrator-ral.
    A meglévő Playwright böngészőn fut — Planner → Actor → Critic retry loop.

    Különbség a /computer_use-hoz képest:
    - Több lépést hajt végre automatikusan (nem egylépéses)
    - Critic ellenőrzi minden lépés sikerét
    - max_retries próbálkozásig újratervez, ha hiba van
    """
    await browser_manager.ensure_active()

    # n8n anchors és general_knowledge betöltése extra hint-ként
    extra_hints = []
    anchors = load_anchors()
    if anchors:
        extra_hints.append(f"ISMERT UI ELEMEK: {json.dumps(anchors, ensure_ascii=False)}")

    memory = load_memory()
    gk = memory.get("general_knowledge", {})
    if gk:
        extra_hints.append(f"ÁLTALÁNOS TUDÁSBÁZIS: {json.dumps(gk, ensure_ascii=False)}")

    past_solutions = memory.get("solutions", {}).get(task[:80], [])
    if past_solutions:
        extra_hints.append(f"KORÁBBI SIKERES LÉPÉSEK: {json.dumps(past_solutions[-3:], ensure_ascii=False)}")

    # Comet max_retries felülírás
    comet_orchestrator.max_retries = max_retries

    # Lépés-napló gyűjtése + Socket.IO broadcast
    step_log = []
    http_client = httpx.AsyncClient(timeout=5.0)

    async def on_step(info: dict):
        step_log.append(info)
        step_type = info.get("type", "")
        if step_type == "step_done":
            status_icon = "✅" if info.get("success") else "❌"
            print(f"  {status_icon} [{info.get('step_index', 0)+1}] {info.get('action', '?')}")
        elif step_type == "attempt_start":
            print(f"🔄 Próbálkozás {info.get('attempt')}/{info.get('max_retries')}")
        # Forward to Node.js Socket.IO
        try:
            await http_client.post(f"{NODE_API}/api/v1/robotkez/step-event", json=info)
        except Exception:
            pass  # Ne akadjon meg ha Node.js nem elérhető

    comet_orchestrator.on_step(on_step)

    print(f"🤖 [Comet Auto] Feladat indítása: {task}")

    try:
        result = await comet_orchestrator.execute_with_page(
            task=task,
            page=state.page,
            context=state.context,
            extra_hints=extra_hints
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comet orchestrátor hiba: {e}")
    finally:
        comet_orchestrator.on_step(None)
        await http_client.aclose()

    # Memóriába mentjük a végeredményt
    save_to_memory(task, {
        "action": "comet_auto",
        "success": result.success,
        "attempts": result.attempts,
        "steps": len(result.data)
    }, success=result.success)

    return {
        "status": "success" if result.success else "error",
        "comet_result": {
            "success": result.success,
            "attempts": result.attempts,
            "steps_completed": len(result.data),
            "error": result.error
        },
        "step_log": step_log
    }

# ---------------------------------------------------------------------
# TRAINING MANAGEMENT — háttérben futó tréning subprocess
# ---------------------------------------------------------------------

import subprocess
import signal

class TrainingProcess:
    """Egyetlen háttér-tréning process kezelője."""
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.mode: str = ""
        self.started_at: Optional[str] = None

    @property
    def running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def start(self, mode: str = "basic", hours: float = 4.0, retries: int = 3):
        if self.running:
            raise RuntimeError("Tréning már fut!")

        suite_path = str(Path(__file__).parent / "training_suite.py")
        cmd = [sys.executable, suite_path, "--retries", str(retries)]
        if mode == "workflows":
            cmd.append("--workflows")
        else:
            cmd.extend(["--hours", str(hours)])

        self.process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            cwd=str(Path(__file__).parent.parent.parent),
            text=True, bufsize=1
        )
        self.mode = mode
        self.started_at = datetime.now().isoformat()

    def stop(self):
        if self.process and self.running:
            self.process.send_signal(signal.SIGTERM)
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.process = None

    def get_output(self, lines: int = 50) -> list[str]:
        if not self.process or not self.process.stdout:
            return []
        output = []
        while self.process.stdout.readable():
            try:
                line = self.process.stdout.readline()
                if not line:
                    break
                output.append(line.rstrip())
            except Exception:
                break
        return output[-lines:]

from datetime import datetime

training_manager = TrainingProcess()

class TrainingStartRequest(BaseModel):
    mode: str = "basic"     # "basic" | "workflows"
    hours: float = 4.0
    retries: int = 3

@app.post("/training/start")
async def start_training(req: TrainingStartRequest):
    """Háttérben elindítja a training suite-ot."""
    try:
        training_manager.start(mode=req.mode, hours=req.hours, retries=req.retries)
        return {
            "status": "started",
            "mode": req.mode,
            "pid": training_manager.process.pid if training_manager.process else None,
            "started_at": training_manager.started_at
        }
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))

@app.get("/training/status")
async def training_status():
    """Visszaadja a futó tréning állapotát."""
    return {
        "running": training_manager.running,
        "mode": training_manager.mode,
        "started_at": training_manager.started_at,
        "pid": training_manager.process.pid if training_manager.process else None,
        "exit_code": training_manager.process.returncode if training_manager.process and not training_manager.running else None
    }

@app.post("/training/stop")
async def stop_training():
    """Leállítja a futó tréninget."""
    if not training_manager.running:
        return {"status": "not_running"}
    training_manager.stop()
    return {"status": "stopped"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
