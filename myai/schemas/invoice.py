"""Invoice data schema using Pydantic for validation."""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, validator


class InvoiceData(BaseModel):
    """
    Pydantic schema for invoice data from Számlázz.hu API or email sources.
    
    Attributes:
        partner (str): Partner/vendor name
        amount (float): Invoice amount (nettó)
        vat_amount (float): VAT/ÁFA amount
        vat_rate (float): VAT percentage (e.g., 27.0 for 27%)
        total_amount (float): Gross amount (amount + vat_amount)
        invoice_date (date): Date of invoice issuance
        due_date (date): Payment deadline
        invoice_no (str): Invoice number/reference
        description (Optional[str]): Additional notes or line items
        currency (str): Currency code (default: HUF)
        payment_status (str): Status (pending, paid, overdue, etc.)
        source (str): Source of invoice (szamlazz_api, gmail, upload, etc.)
    """

    # required fields
    partner: str = Field(..., min_length=1, max_length=200, description="Partner/vendor name")
    amount: float = Field(..., ge=0.0, description="Net invoice amount")
    vat_amount: float = Field(..., ge=0.0, description="VAT amount")
    vat_rate: float = Field(27.0, ge=0.0, le=100.0, description="VAT percentage")
    invoice_date: date = Field(..., description="Invoice issuance date")
    due_date: date = Field(..., description="Payment due date")

    # semi-required fields
    invoice_no: str = Field(..., min_length=1, max_length=50, description="Invoice number/reference")
    total_amount: Optional[float] = Field(
        None, ge=0.0, description="Gross total (auto-calculated if missing)"
    )

    # optional fields
    description: Optional[str] = Field(None, max_length=1000, description="Notes or line items")
    currency: str = Field("HUF", min_length=3, max_length=3, description="Currency code")
    payment_status: str = Field(
        "pending",
        regex="^(pending|paid|overdue|cancelled|partial)$",
        description="Payment status",
    )
    source: str = Field(
        "unknown",
        regex="^(szamlazz_api|gmail|upload|harvest)$",
        description="Data source",
    )

    class Config:
        """Pydantic config."""
        json_encoders = {date: lambda v: v.isoformat()}
        example = {
            "partner": "Acme Corp",
            "amount": 100000.00,
            "vat_amount": 27000.00,
            "vat_rate": 27.0,
            "invoice_date": "2026-02-14",
            "due_date": "2026-03-14",
            "invoice_no": "2026-00123",
            "total_amount": 127000.00,
            "description": "Consulting services",
            "currency": "HUF",
            "payment_status": "pending",
            "source": "szamlazz_api",
        }

    @validator("due_date")
    def due_date_after_invoice_date(cls, v: date, values: dict) -> date:
        """Validate that due_date is after invoice_date."""
        if "invoice_date" in values and v < values["invoice_date"]:
            raise ValueError("due_date must be after invoice_date")
        return v

    @validator("total_amount", pre=True, always=True)
    def calculate_total(cls, v: Optional[float], values: dict) -> float:
        """Auto-calculate total_amount if not provided."""
        if v is not None:
            return v
        if "amount" in values and "vat_amount" in values:
            return values["amount"] + values["vat_amount"]
        return 0.0

    def dict_for_sheets(self) -> dict:
        """
        Convert to dict format suitable for Google Sheets row.
        
        Returns:
            dict with keys matching Google Sheets column headers
        """
        return {
            "Partner": self.partner,
            "Szám": self.invoice_no,
            "Dátum": self.invoice_date.isoformat(),
            "Határidő": self.due_date.isoformat(),
            "Nettó": f"{self.amount:.2f}",
            "ÁFA %": f"{self.vat_rate:.1f}",
            "ÁFA": f"{self.vat_amount:.2f}",
            "Bruttó": f"{self.total_amount:.2f}",
            "Státusz": self.payment_status,
            "Forrás": self.source,
            "Megjegyzés": self.description or "",
        }
