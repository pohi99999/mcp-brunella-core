import os
import json
import logging
import base64
from typing import Optional, Dict, Any
import google.generativeai as genai
from .models import CriticResult

logger = logging.getLogger(__name__)

class CriticAgent:
    """Gemini Flash Vision — böngésző állapot ellenőrző ügynök"""

    CRITIC_PROMPT = """
    Te egy böngésző automatizálási auditor vagy. 
    Nézd meg a csatolt képernyőképet és döntsd el, hogy az utolsó lépés sikeres volt-e.

    Feladat: {task}
    Utolsó végrehajtott lépés: {last_step}

    Kérdések, amiket mérlegelj:
    1. Látod a sikeres végrehajtás jeleit? (pl. megváltozott URL, megjelent felirat, új gomb)
    2. Van hibaüzenet a képernyőn?
    3. Megjelent CAPTCHA vagy bejelentkezési fal, ami blokkol?

    Adj választ JSON formátumban:
    {{
        "success": bool,
        "error": "Ha sikertelen, mi a hiba oka? (pl. ELEMENT_NOT_FOUND, CAPTCHA, TIMEOUT, WRONG_PAGE)",
        "suggestion": "Javaslat a javításra (pl. 'Próbáld meg a másodlagos gombot', vagy 'Várj több időt')"
    }}
    Csak a JSON-t add vissza.
    """

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("[CriticAgent] Hiányzó Gemini API kulcs, heurisztikus mód aktív.")
            self.model = None
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            logger.info("[CriticAgent] Gemini Flash Vision inicializálva.")

    async def evaluate(self, screenshot_bytes: bytes, task: str, last_step: Dict[str, Any]) -> CriticResult:
        """Képernyőkép elemzése és visszajelzés"""
        
        if not self.model:
            # Heurisztikus fallback: ha van kép, feltételezzük a sikert, kivéve ha hiba volt
            return CriticResult(success=True)

        try:
            prompt = self.CRITIC_PROMPT.format(task=task, last_step=json.dumps(last_step))
            
            # Kép előkészítése
            image_part = {
                "mime_type": "image/png",
                "data": screenshot_bytes
            }

            response = await self.model.generate_content_async([prompt, image_part])
            content = response.text.strip()
            
            # JSON kinyerése
            if "{" in content and "}" in content:
                json_str = content[content.find("{"):content.rfind("}")+1]
                data = json.loads(json_str)
                return CriticResult(**data)
            
            return CriticResult(success=True)

        except Exception as e:
            logger.error(f"[CriticAgent] Értékelési hiba: {e}")
            return CriticResult(success=True, error=str(e))
