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
    from myai.utils.google_credentials import resolve_google_service_account_source
except Exception as exc:  # pragma: no cover - dependency guard
    pytest.skip(
        f"Invoice automation dependencies missing: {exc}",
        allow_module_level=True,
    )

REQUIRED_ENV = (
    "SZAMLAZZ_HU_API_KEY",
    "SZAMLAZZ_HU_ACCOUNT_ID",
    "GOOGLE_SHEETS_ID",
)


def _get_skip_reason() -> str:
    missing = [key for key in REQUIRED_ENV if not os.getenv(key)]
    if missing:
        return f"Missing required env vars: {', '.join(missing)}"

    service_account_source = resolve_google_service_account_source()
    adc_value = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not service_account_source.value and not adc_value:
        return (
            "Missing Google Sheets credentials: set GOOGLE_CREDENTIALS_FILE, "
            "GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS"
        )

    if service_account_source.value and not service_account_source.is_inline_json:
        creds_path = Path(service_account_source.value).expanduser()
        if not creds_path.exists():
            source_name = service_account_source.source_name or "explicit credentials path"
            return f"{source_name} file not found: {creds_path}"

    if not service_account_source.value and adc_value:
        creds_path = Path(adc_value).expanduser()
        if not creds_path.exists():
            return f"GOOGLE_APPLICATION_CREDENTIALS file not found: {creds_path}"

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

    service_account_source = resolve_google_service_account_source()
    sheets_config = SheetsConfig(
        spreadsheet_id=os.getenv("GOOGLE_SHEETS_ID", ""),
        sheet_name=os.getenv("GOOGLE_SHEETS_NAME", "Invoices"),
        credentials_json=service_account_source.value,
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
