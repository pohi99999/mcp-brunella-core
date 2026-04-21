import os
import json
import logging
from typing import List, Optional
from openai import AsyncOpenAI
from .models import BrowserStep

logger = logging.getLogger(__name__)

class TaskPlanner:
    """GPT-4o via GitHub Models API — feladat lebontó és tervező"""

    SYSTEM_PROMPT = """
    Te egy web automatizálási tervező vagy.
    A feladatod, hogy egy természetes nyelven megadott böngésző feladatot felbonts konkrét, végrehajtható lépésekre.
    
    Lépés típusok:
    - navigate: { "action": "navigate", "url": "..." }
    - search: { "action": "search", "selector": "...", "text": "..." } (Együtt hajtja végre a beírást és az Enter-t)
    - click: { "action": "click", "selector": "...", "description": "..." }
    - fill: { "action": "fill", "selector": "...", "text": "..." }
    - extract: { "action": "extract", "selector": "...", "key": "..." }
    - screenshot: { "action": "screenshot", "description": "..." }
    - wait: { "action": "wait", "seconds": 2 }

    SZABÁLYOK:
    1. Csak érvényes JSON tömböt adj vissza BrowserStep objektumokkal.
    2. Ha nem tudod a pontos CSS selectort, hagyd üresen (None), de adj meg egy pontos 'description'-t, amit a vision agent fel tud használni.
    3. Maximum 10 lépést tervezz meg egyszerre.
    4. Legyél proaktív: ha keresni kell, navigálj a megfelelő oldalra előbb.
    5. A válaszod kizárólag a JSON tömb legyen, semmi más szöveg.
    """

    def __init__(self, model: str = "gpt-4o"):
        self.model = model
        github_pat = os.getenv("GITHUB_PAT")
        
        if github_pat:
            self.client = AsyncOpenAI(
                base_url="https://models.inference.ai.azure.com",
                api_key=github_pat
            )
            logger.info(f"[AI] [TaskPlanner] GitHub Models kliens inicializalva ({model})")
        else:
            # Ollama fallback
            self.client = AsyncOpenAI(
                base_url="http://localhost:11434/v1",
                api_key="ollama"
            )
            self.model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
            logger.warning(f"[WARN] [TaskPlanner] GITHUB_PAT hianyzik, Ollama fallback: {self.model}")

    async def plan(self, task: str, current_url: str = "", memory_hints: List[str] = []) -> List[BrowserStep]:
        """Természetes nyelvű feladat → BrowserStep lista"""
        
        user_prompt = f"Feladat: {task}\nAktuális URL: {current_url}"
        if memory_hints:
            user_prompt += "\n\nKorábbi tapasztalatok (Memory):\n" + "\n".join(memory_hints)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"} if "gpt-4o" in self.model else None
            )

            content = response.choices[0].message.content
            # Megpróbáljuk kinyerni a JSON-t ha a modell szöveget is írna mellé
            if "[" in content and "]" in content:
                json_str = content[content.find("["):content.rfind("]")+1]
                steps_data = json.loads(json_str)
            else:
                # Hátha json_object módban egy 'steps' kulcs alá tette
                data = json.loads(content)
                steps_data = data.get("steps", data) if isinstance(data, dict) else data

            steps = [BrowserStep(**step) for step in steps_data]
            logger.info(f"[AI] [TaskPlanner] Terv elkeszult: {len(steps)} lepes")
            return steps

        except Exception as e:
            logger.error(f"[ERROR] [TaskPlanner] Hiba a tervezes soran: {e}")
            # Alapértelmezett vészterv: keresés a feladatra
            return [
                BrowserStep(
                    action="navigate", 
                    url=f"https://www.google.com/search?q={task.replace(' ', '+')}",
                    description="Hiba történt a tervezésnél, alapértelmezett keresés indítása"
                )
            ]
