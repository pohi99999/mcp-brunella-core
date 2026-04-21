import pytest
import asyncio
from myai.refiners.invoice_parser import parse_invoice_text
from data.invoice_templates.invoice_schema import InvoiceData

@pytest.mark.asyncio
async def test_parse_invoice_text_success():
    sample_text = """
    Szállító: TechSupply Kft.
    Számla sorszáma: INV-2026-001
    Kelt: 2026-02-20
    Határidő: 2026-03-05
    Végösszeg: 150000 HUF
    """
    invoice_data = await parse_invoice_text(sample_text)
    
    assert isinstance(invoice_data, InvoiceData)
    assert invoice_data.invoice_number == "INV-2026-001"
    assert invoice_data.vendor_name == "TechSupply Kft."
    assert invoice_data.amount == 150000.0
    assert invoice_data.currency == "HUF"
    assert str(invoice_data.invoice_date) == "2026-02-20"
    assert str(invoice_data.due_date) == "2026-03-05"

@pytest.mark.asyncio
async def test_parse_invoice_text_missing_fields():
    sample_text = "Valami szöveg számla adatok nélkül."
    invoice_data = await parse_invoice_text(sample_text)
    
    assert invoice_data.invoice_number == "N/A"
    assert invoice_data.vendor_name == "Ismeretlen"
    assert invoice_data.amount == 0.0
