"""End-to-end invoice automation test (Számlázz.hu -> Refiner -> Google Sheets).

This test runs only when the required credentials are present in the environment.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest

try:
    from myai.clients.enhanced_invoice_client import EnhancedInvoiceClient
    from myai.clients.google_sheets_client import GoogleSheetsClient, SheetsConfig
    from myai.refiner.invoice_refiner import InvoiceRefiner
except Exception as exc:  # pragma: no cover - dependency guard
    pytest.skip(
        f"Invoice automation dependencies missing: {exc}",
        allow_module_level=True,
    )

REQUIRED_ENV = (
    "SZAMLAZZ_HU_API_KEY",
    "SZAMLAZZ_HU_ACCOUNT_ID",
    "GOOGLE_SHEETS_ID",
    "GOOGLE_SHEETS_CREDS",
)


def _get_skip_reason() -> str:
    missing = [key for key in REQUIRED_ENV if not os.getenv(key)]
    if missing:
        return f"Missing required env vars: {', '.join(missing)}"

    creds_value = os.getenv("GOOGLE_SHEETS_CREDS", "").strip()
    if creds_value and not creds_value.startswith("{"):
        creds_path = Path(creds_value).expanduser()
        if not creds_path.exists():
            return f"GOOGLE_SHEETS_CREDS file not found: {creds_path}"

    return ""


@pytest.mark.e2e
def test_invoice_automation_e2e() -> None:
    """Smoke-test the full invoice pipeline with real credentials."""
    skip_reason = _get_skip_reason()
    if skip_reason:
        pytest.skip(skip_reason)

    client = EnhancedInvoiceClient()
    invoices = client.get_invoices(limit=5, force_refresh=True)

    if not invoices:
        pytest.skip("No invoices returned from Számlázz.hu/Gmail")

    raw_invoices = [invoice.model_dump(mode="json") for invoice in invoices]

    refiner = InvoiceRefiner()
    refine_result = asyncio.run(refiner.refine_and_index(raw_invoices))

    assert refine_result["validated"] > 0
    assert refine_result["status"] in {"COMPLETE", "PARTIAL"}

    sheets_config = SheetsConfig(
        spreadsheet_id=os.getenv("GOOGLE_SHEETS_ID", ""),
        sheet_name=os.getenv("GOOGLE_SHEETS_NAME", "Invoices"),
        credentials_json=os.getenv("GOOGLE_SHEETS_CREDS", ""),
    )
    sheets_client = GoogleSheetsClient(sheets_config)

    write_result = sheets_client.write_invoices(
        invoices,
        append=True,
        include_line_items=False,
        skip_duplicates=True,
        batch_size=50,
    )

    assert write_result.get("success") is True
    assert "row_count" in write_result
