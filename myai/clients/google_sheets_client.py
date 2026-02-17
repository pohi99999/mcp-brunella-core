"""Google Sheets API Client for Invoice Data Sync

Features:
- Batch write invoices to Google Sheet
- Auto-create headers from invoice fields
- Support for line items expansion
- Append-only (avoid overwrites)
- Automatic sheet management
"""

import os
import json
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
from google.oauth2 import service_account
from google.auth import default
import gspread
from gspread_dataframe import set_with_dataframe
import pandas as pd

from myai.schemas.invoice import InvoiceData


@dataclass
class SheetsConfig:
    """Google Sheets configuration."""
    spreadsheet_id: str
    sheet_name: str = "Invoices"
    credentials_json: Optional[str] = None  # Path or JSON string
    scopes: List[str] = None

    def __post_init__(self):
        if self.scopes is None:
            self.scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ]


class GoogleSheetsClient:
    """Google Sheets client for invoice data management."""

    def __init__(self, config: Optional[SheetsConfig] = None):
        """Initialize Google Sheets client.
        
        Args:
            config: SheetsConfig with spreadsheet_id and credentials
                    If None, uses environment variables
        """
        self.config = config or self._load_config_from_env()
        self.client = None
        self.spreadsheet = None
        self.worksheet = None
        self._auth()

    def _load_config_from_env(self) -> SheetsConfig:
        """Load configuration from environment variables."""
        return SheetsConfig(
            spreadsheet_id=os.getenv("GOOGLE_SHEETS_ID", ""),
            sheet_name=os.getenv("GOOGLE_SHEETS_NAME", "Invoices"),
            credentials_json=os.getenv("GOOGLE_SHEETS_CREDS"),
        )

    def _auth(self) -> None:
        """Authenticate with Google Sheets API."""
        try:
            # Try service account credentials first
            if self.config.credentials_json:
                if self.config.credentials_json.startswith("{"):
                    # JSON string
                    creds_dict = json.loads(self.config.credentials_json)
                    credentials = service_account.Credentials.from_service_account_info(
                        creds_dict,
                        scopes=self.config.scopes,
                    )
                else:
                    # File path
                    credentials = service_account.Credentials.from_service_account_file(
                        self.config.credentials_json,
                        scopes=self.config.scopes,
                    )
                self.client = gspread.authorize(credentials)
            else:
                # Try default credentials (Application Default Credentials)
                credentials, _ = default(scopes=self.config.scopes)
                if credentials:
                    self.client = gspread.authorize(credentials)
                else:
                    raise Exception("No Google credentials found")

            # Open spreadsheet
            self.spreadsheet = self.client.open_by_key(self.config.spreadsheet_id)
            # Try to get worksheet, or create if not exists
            self.worksheet = self._get_or_create_worksheet()

        except Exception as e:
            raise Exception(f"Google Sheets auth failed: {str(e)}") from e

    def _get_or_create_worksheet(self) -> gspread.Worksheet:
        """Get or create worksheet by name."""
        try:
            # Try to find existing worksheet
            return self.spreadsheet.worksheet(self.config.sheet_name)
        except gspread.exceptions.WorksheetNotFound:
            # Create new worksheet
            return self.spreadsheet.add_worksheet(
                title=self.config.sheet_name,
                rows=1000,
                cols=20,
            )

    def _get_headers(self, include_line_items: bool = False) -> List[str]:
        """Get header row for invoice sheet."""
        headers = [
            "Invoice No",
            "Date",
            "Partner",
            "Amount (HUF)",
            "VAT Amount (HUF)",
            "Total (HUF)",
            "Status",
            "Due Date",
            "Days Until Due",
            "Overdue",
            "VAT Region",
            "Description",
        ]

        if include_line_items:
            headers.extend([
                "Line Items Count",
                "Line Items (JSON)",
            ])

        return headers

    def _invoice_to_row(self, invoice: InvoiceData, include_line_items: bool = False) -> list:
        """Convert invoice to sheet row."""
        row = [
            invoice.invoice_no,
            invoice.invoice_date.isoformat() if invoice.invoice_date else "",
            invoice.partner,
            invoice.amount,
            invoice.vat_amount,
            invoice.amount + invoice.vat_amount,
            invoice.payment_status,
            invoice.due_date.isoformat() if invoice.due_date else "",
            invoice.days_until_due(),
            "Yes" if invoice.is_overdue() else "No",
            invoice.vat_type or "HU",
            invoice.description or "",
        ]

        if include_line_items:
            line_items_count = len(invoice.line_items) if invoice.line_items else 0
            line_items_json = (
                json.dumps([item.to_dict() for item in invoice.line_items])
                if invoice.line_items and line_items_count > 0
                else ""
            )
            row.extend([
                line_items_count,
                line_items_json,
            ])

        return row

    def write_invoices(
        self,
        invoices: List[InvoiceData],
        append: bool = True,
        include_line_items: bool = False,
    ) -> Dict[str, Any]:
        """Write invoices to sheet.
        
        Args:
            invoices: List of invoice objects
            append: If True, append to sheet; if False, replace content
            include_line_items: Include line items in output
            
        Returns:
            Success/error status with row count
        """
        try:
            headers = self._get_headers(include_line_items)
            rows = [headers]
            rows.extend([
                self._invoice_to_row(inv, include_line_items)
                for inv in invoices
            ])

            # Check if sheet has content
            existing_values = self.worksheet.get_all_values()

            if append and existing_values:
                # Append mode: skip header, append rows
                self.worksheet.append_rows(rows[1:])
            else:
                # Replace mode: clear and write all
                self.worksheet.clear()
                self.worksheet.append_rows(rows)

            return {
                "success": True,
                "row_count": len(invoices),
                "sheet": self.config.sheet_name,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "sheet": self.config.sheet_name,
            }

    def read_invoices(self) -> Dict[str, Any]:
        """Read all invoice data from sheet."""
        try:
            values = self.worksheet.get_all_values()
            if not values:
                return {
                    "success": True,
                    "count": 0,
                    "invoices": [],
                }

            headers = values[0]
            invoices = []

            for row in values[1:]:
                invoice_dict = {}
                for i, header in enumerate(headers):
                    if i < len(row):
                        invoice_dict[header] = row[i]

                invoices.append(invoice_dict)

            return {
                "success": True,
                "count": len(invoices),
                "invoices": invoices,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "count": 0,
            }

    def clear_sheet(self) -> Dict[str, Any]:
        """Clear all data from sheet."""
        try:
            self.worksheet.clear()
            return {
                "success": True,
                "message": f"Sheet '{self.config.sheet_name}' cleared",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    def health_check(self) -> bool:
        """Check if client is connected and authenticated."""
        try:
            # Try to access spreadsheet metadata
            _ = self.spreadsheet.metadata
            return True
        except Exception:
            return False


# Singleton instance
_sheets_client: Optional[GoogleSheetsClient] = None


def get_sheets_client(config: Optional[SheetsConfig] = None) -> GoogleSheetsClient:
    """Get or create singleton Google Sheets client."""
    global _sheets_client
    if _sheets_client is None:
        _sheets_client = GoogleSheetsClient(config)
    return _sheets_client


if __name__ == "__main__":
    # Test
    import sys
    sys.path.insert(0, ".")

    # Sample usage
    config = SheetsConfig(
        spreadsheet_id=os.getenv("GOOGLE_SHEETS_ID", ""),
        sheet_name="Invoices",
    )
    client = GoogleSheetsClient(config)

    invoices = [
        InvoiceData(
            partner="Test Co",
            amount=10000,
            vat_amount=2700,
            invoice_no="2026-001",
            invoice_date="2026-02-15",
            due_date="2026-03-15",
            description="Test invoice",
        ),
    ]

    result = client.write_invoices(invoices)
    print(f"Write result: {result}")

    read_result = client.read_invoices()
    print(f"Read result: {read_result}")
