from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class BrowserStep(BaseModel):
    """Egyetlen böngésző akció definíciója"""
    action: str = Field(..., description="Az elvégzendő művelet (navigate, click, click_os, type, type_os, press_key, scroll, fill, search, extract, screenshot, wait)")
    selector: Optional[str] = Field(None, description="CSS selector az elemhez")
    url: Optional[str] = Field(None, description="Cél URL navigáció esetén")
    text: Optional[str] = Field(None, description="Beírandó szöveg")
    key: Optional[str] = Field(None, description="Adatkinyerés esetén a kulcs neve")
    description: Optional[str] = Field(None, description="A lépés emberi nyelvű leírása a vision agent számára")
    critical: bool = Field(False, description="Ha igaz, a hiba esetén azonnali megállás és újratervezés történik")
    tab_index: int = Field(0, description="Melyik fülön hajtódjon végre a művelet")
    x: Optional[int] = Field(None, description="Pixel X koordináta (click_os, click esetén)")
    y: Optional[int] = Field(None, description="Pixel Y koordináta (click_os, click esetén)")

class ActorResult(BaseModel):
    """Egy BrowserStep végrehajtásának eredménye"""
    success: bool
    extracted: Dict[str, Any] = Field(default_factory=dict)
    screenshot: Optional[bytes] = None
    error: Optional[str] = None

class CriticResult(BaseModel):
    """A CriticAgent értékelése egy lépésről"""
    success: bool
    error: Optional[str] = None
    suggestion: Optional[str] = None

class CometResult(BaseModel):
    """A teljes Comet folyamat végeredménye"""
    success: bool
    data: List[ActorResult] = Field(default_factory=list)
    error: Optional[str] = None
    attempts: int = 1

class CometTask(BaseModel):
    """Bemeneti feladat a CometOrchestrator számára"""
    task: str
    context: Dict[str, Any] = Field(default_factory=dict)
