from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import List, Optional
import random

router = APIRouter(prefix="/demo/finance", tags=["demos"])

class InvoiceItem(BaseModel):
    id: str
    vendor: str
    amount: float
    currency: str = "HUF"
    status: str
    anomaly_detected: bool = False
    warning_reason: Optional[str] = None

class FinanceAuditReport(BaseModel):
    total_processed: int
    anomalies_found: int
    estimated_savings: float
    items: List[InvoiceItem]

@router.post("/process-batch", response_model=FinanceAuditReport)
async def process_batch(invoices: List[dict] = Body(...)):
    """
    Simulates smart invoice processing and anomaly detection for accounting demos.
    """
    processed_items = []
    anomalies = 0
    
    vendors = ["MOL", "Telekom", "E.ON", "Vízművek", "Partner Kft"]
    
    for i, inv in enumerate(invoices):
        is_anomaly = random.random() < 0.2 # 20% chance of anomaly
        vendor = inv.get("vendor") or random.choice(vendors)
        amount = inv.get("amount") or round(random.uniform(5000, 150000), 0)
        
        reason = None
        if is_anomaly:
            anomalies += 1
            reasons = ["Dupla számla detektálva", "Szokatlanul magas összeg", "Eltérő bankszámlaszám"]
            reason = random.choice(reasons)
            
        processed_items.append(InvoiceItem(
            id=f"INV-2026-{100+i}",
            vendor=vendor,
            amount=amount,
            status="Flagged" if is_anomaly else "Validated",
            anomaly_detected=is_anomaly,
            warning_reason=reason
        ))
        
    return FinanceAuditReport(
        total_processed=len(processed_items),
        anomalies_found=anomalies,
        estimated_savings=anomalies * 12500, # Estimated cost of error
        items=processed_items
    )
