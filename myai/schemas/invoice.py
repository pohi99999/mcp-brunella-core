"""Invoice data schema using Pydantic for validation."""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator
import json


class LineItem(BaseModel):
    """
    Individual line item within an invoice.
    Supports quantity-based calculations with configurable VAT.
    """

    description: str = Field(..., min_length=1, max_length=500, description="Line item description")
    quantity: float = Field(..., gt=0, description="Quantity (e.g., hours, units)")
    unit_price: float = Field(..., ge=0, description="Unit price (nettó)")
    vat_rate: float = Field(27.0, ge=0, le=100, description="VAT rate % for this item")

    class Config:
        """Pydantic config."""
        json_encoders = {float: lambda v: round(v, 2)}

    @property
    def amount(self) -> float:
        """Calculate total amount (nettó)."""
        return round(self.quantity * self.unit_price, 2)

    @property
    def vat_amount(self) -> float:
        """Calculate VAT amount."""
        return round(self.amount * (self.vat_rate / 100), 2)

    @property
    def total(self) -> float:
        """Calculate total (bruttó)."""
        return round(self.amount + self.vat_amount, 2)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "description": self.description,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "vat_rate": self.vat_rate,
            "amount": self.amount,
            "vat_amount": self.vat_amount,
            "total": self.total,
        }


class VATType(BaseModel):
    """
    VAT configuration for different regions/countries.
    Supports multiple tax rates (standard, reduced, super-reduced).
    """

    code: str = Field(..., min_length=2, max_length=2, description="Country code (e.g., 'HU')")
    standard_rate: float = Field(27.0, ge=0, le=100, description="Standard VAT rate (%)")
    reduced_rate: float = Field(19.0, ge=0, le=100, description="Reduced rate (%) - food, books, etc.")
    super_reduced_rate: float = Field(5.0, ge=0, le=100, description="Super reduced rate (%)")

    class Config:
        """Pydantic config."""

        example = {
            "code": "HU",
            "standard_rate": 27.0,
            "reduced_rate": 19.0,
            "super_reduced_rate": 5.0,
        }


# Standard Hungary VAT configuration
HU_VAT = VATType(
    code="HU",
    standard_rate=27.0,
    reduced_rate=19.0,
    super_reduced_rate=5.0,
)

# EU VAT rates reference
EU_VAT_RATES = {
    "HU": HU_VAT,
    "AT": VATType(code="AT", standard_rate=20.0, reduced_rate=10.0, super_reduced_rate=5.0),
    "DE": VATType(code="DE", standard_rate=19.0, reduced_rate=7.0, super_reduced_rate=0.0),
    "SK": VATType(code="SK", standard_rate=20.0, reduced_rate=10.0, super_reduced_rate=0.0),
}



class InvoiceData(BaseModel):
    """
    Pydantic schema for invoice data from Számlázz.hu API or email sources.
    
    Supports:
    - Basic invoice with single amount
    - Detailed line items (quantity-based)
    - Multiple VAT rates (HU: 27%, 19%, 5%)
    - Automatic overdue calculation
    
    Attributes:
        partner (str): Partner/vendor name
        amount (float): Invoice amount (nettó)
        vat_amount (float): VAT/ÁFA amount
        vat_rate (float): VAT percentage (e.g., 27.0 for 27%)
        total_amount (float): Gross amount (amount + vat_amount)
        invoice_date (date): Date of invoice issuance
        due_date (date): Payment deadline
        invoice_no (str): Invoice number/reference
        description (Optional[str]): Additional notes
        line_items (Optional[List[LineItem]]): Detailed line items
        vat_type (Optional[str]): VAT region code (HU, AT, DE, SK)
        currency (str): Currency code (default: HUF)
        payment_status (str): Status (pending, paid, overdue, cancelled, partial)
        source (str): Source of invoice (szamlazz_api, gmail, upload, harvest)
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

    # optional fields - line items detail
    line_items: Optional[List[LineItem]] = Field(
        None, description="Detailed line items (quantity-based)"
    )
    
    description: Optional[str] = Field(None, max_length=1000, description="Notes or summary")
    
    # VAT region support
    vat_type: str = Field(
        "HU",
        regex="^(HU|AT|DE|SK)$",
        description="VAT region code (HU=Hungary, AT=Austria, DE=Germany, SK=Slovakia)",
    )
    
    currency: str = Field("HUF", min_length=3, max_length=3, description="Currency code")
    payment_status: str = Field(
        "pending",
        regex="^(pending|paid|overdue|cancelled|partial)$",
        description="Payment status (auto-set to 'overdue' if due_date passed)",
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

    @validator("payment_status", pre=False, always=True)
    def calculate_overdue_status(cls, v: str, values: dict) -> str:
        """
        AUTOMATIC OVERDUE CALCULATION:
        If due_date has passed and status is 'pending', set to 'overdue'.
        """
        if "due_date" in values and "payment_status" in values:
            # Only auto-set to overdue if currently pending
            current_status = values.get("payment_status", "pending")
            if current_status == "pending" and values["due_date"] < date.today():
                return "overdue"
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
        
        Supports both simple and line-item based invoices.
        
        Returns:
            dict with keys matching Google Sheets column headers
        """
        base_dict = {
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
            "VAT Region": self.vat_type,
            "Megjegyzés": self.description or "",
        }
        
        # Add line items if present
        if self.line_items:
            base_dict["Line Items"] = json.dumps(
                [item.to_dict() for item in self.line_items],
                indent=2,
                default=str
            )
        
        return base_dict
    
    def is_overdue(self) -> bool:
        """
        Check if invoice is overdue (due_date < today).
        """
        return self.due_date < date.today()
    
    def days_until_due(self) -> int:
        """
        Calculate days until due date.
        Negative value = overdue by X days.
        """
        return (self.due_date - date.today()).days
    
    def get_vat_config(self) -> VATType:
        """
        Get VAT configuration for this invoice's region.
        """
        return EU_VAT_RATES.get(self.vat_type, HU_VAT)
    
    def calculate_from_line_items(self) -> tuple:
        """
        Calculate totals from line items if available.
        
        Returns:
            (amount, vat_amount, total_amount)
        """
        if not self.line_items:
            return self.amount, self.vat_amount, self.total_amount
        
        total_amount = sum(item.amount for item in self.line_items)
        total_vat = sum(item.vat_amount for item in self.line_items)
        total_gross = sum(item.total for item in self.line_items)
        
        return total_amount, total_vat, total_gross
