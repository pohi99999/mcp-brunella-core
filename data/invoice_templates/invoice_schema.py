from pydantic import BaseModel, Field
from datetime import date
from typing import List, Optional

class InvoiceItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float

class InvoiceData(BaseModel):
    invoice_number: str = Field(..., description="A számla sorszáma")
    vendor_name: str = Field(..., description="Az eladó/szolgáltató neve")
    amount: float = Field(..., description="A számla végösszege")
    currency: str = Field("HUF", description="Pénznem (pl. HUF, EUR)")
    invoice_date: date = Field(..., description="A számla kelte")
    due_date: Optional[date] = Field(None, description="Fizetési határidő")
    line_items: List[InvoiceItem] = Field(default_factory=list, description="Számlatételek")
    confidence: float = Field(0.0, description="OCR feldolgozás megbízhatósága (0-100)")
