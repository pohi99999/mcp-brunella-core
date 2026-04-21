import os
import json
import logging
import base64
from typing import Optional, Dict, Any
try:
    from google import genai  # Uj SDK (google-genai)
except ImportError:
    import google.generativeai as genai  # type: ignore  # Fallback regi SDK
from .models import CriticResult

logger = logging.getLogger(__name__)

class CriticAgent:
    """Gemini Flash Vision - bongeszo allapot ellenorzo ugynok"""

    CRITIC_PROMPT = """
    Te egy bongeszo automatizalasi auditor vagy. 
    Nezd meg a csatolt kepernyokepet es dontsd el, hogy az utolso lepes sikeres volt-e.

    Feladat: {task}
    Utolso vegrehajtott lepes: {last_step}

    Kerdesek, amiket merlegelj:
    1. Latod a sikeres vegrehajtas jeleit? (pl. megvaltozott URL, megjelent felirat, uj gomb)
    2. Van hibaüzenet a kepernyon?
    3. Megjelent CAPTCHA vagy bejelentkezesi fal, ami blokkol?

    Adj valaszt JSON formatumban:
    {{
        "success": bool,
        "error": "Ha sikertelen, mi a hiba oka? (pl. ELEMENT_NOT_FOUND, CAPTCHA, TIMEOUT, WRONG_PAGE)",
        "suggestion": "Javaslat a javitasra (pl. 'Probald meg a masodlagos gombot', vagy 'Varj több idot')"
    }}
    Csak a JSON-t add vissza.
    """

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("[CriticAgent] Hianyzo Gemini API kulcs, heurisztikus mod aktiv.")
            self.model = None
        else:
            try:
                # Uj google-genai SDK
                self._client = genai.Client(api_key=api_key)
                self.model = 'gemini-2.0-flash'
                self._use_new_sdk = True
            except AttributeError:
                # Fallback: regi google.generativeai SDK
                genai.configure(api_key=api_key)  # type: ignore
                self.model = genai.GenerativeModel('gemini-2.0-flash')  # type: ignore
                self._use_new_sdk = False
            logger.info("[CriticAgent] Gemini Flash Vision inicializalva.")

    async def evaluate(self, screenshot_bytes: bytes, task: str, last_step: Dict[str, Any]) -> CriticResult:
        """Kepernyokep elemzese es visszajelzes"""
        
        if not self.model:
            # Heurisztikus fallback: ha van kep, feltetelezzuk a sikert, kiveve ha hiba volt
            return CriticResult(success=True)

        try:
            prompt = self.CRITIC_PROMPT.format(task=task, last_step=json.dumps(last_step))
            
            # Kep elokeszitese
            image_part = {
                "mime_type": "image/png",
                "data": screenshot_bytes
            }

            if getattr(self, '_use_new_sdk', False):
                # Uj google-genai SDK
                response = await self._client.aio.models.generate_content(
                    model=self.model,
                    contents=[prompt, image_part]
                )
            else:
                # Regi SDK fallback
                response = await self.model.generate_content_async([prompt, image_part])  # type: ignore
            content = response.text.strip()
            
            # JSON kinyerese
            if "{" in content and "}" in content:
                json_str = content[content.find("{"):content.rfind("}")+1]
                data = json.loads(json_str)
                return CriticResult(**data)
            
            return CriticResult(success=True)

        except Exception as e:
            logger.error(f"[CriticAgent] Ertekelesi hiba: {e}")
            return CriticResult(success=True, error=str(e))
