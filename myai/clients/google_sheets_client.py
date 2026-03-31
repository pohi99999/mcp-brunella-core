"""Google Sheets API Client for Invoice Data Sync

Features:
- Batch write invoices to Google Sheet (50-100 rows optimized)
- Phoenix Protocol: Auto-retry with exponential backoff
- Duplicate detection via invoice_no
- Auto-create headers from invoice fields
- Support for line items expansion
- Append-only (avoid overwrites)
- Automatic sheet management
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any, Set
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
from myai.utils.phoenix_protocol import retry_on_network_error, get_checkpoint

logger = logging.getLogger(__name__)


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

    def _get_existing_invoice_numbers(self) -> Set[str]:
        """
        Get set of existing invoice numbers from sheet.
        
        Used for duplicate detection.
        
        Returns:
            Set of invoice_no strings already in sheet
        """
        try:
            values = self.worksheet.get_all_values()
            if not values or len(values) < 2:  # No data rows (only header or empty)
                return set()
            
            # First column is invoice_no
            invoice_numbers = {row[0] for row in values[1:] if row and row[0]}
            logger.info(f"Found {len(invoice_numbers)} existing invoices in sheet")
            return invoice_numbers
            
        except Exception as e:
            logger.warning(f"Could not fetch existing invoices: {e}")
            return set()

    def _filter_duplicates(
        self, 
        invoices: List[InvoiceData],
        skip_duplicates: bool = True
    ) -> tuple[List[InvoiceData], List[str]]:
        """
        Filter out duplicate invoices by invoice_no.
        
        Args:
            invoices: List of invoices to check
            skip_duplicates: If True, skip duplicates; if False, keep them
        
        Returns:
            Tuple of (filtered_invoices, duplicate_invoice_nos)
        """
        if not skip_duplicates:
            return invoices, []
        
        existing_nos = self._get_existing_invoice_numbers()
        
        filtered_invoices = []
        duplicates = []
        
        for invoice in invoices:
            if invoice.invoice_no in existing_nos:
                duplicates.append(invoice.invoice_no)
                logger.debug(f"Skipping duplicate invoice: {invoice.invoice_no}")
            else:
                filtered_invoices.append(invoice)
        
        if duplicates:
            logger.info(f"Filtered {len(duplicates)} duplicate invoices: {duplicates[:5]}...")
        
        return filtered_invoices, duplicates

    @retry_on_network_error(max_retries=5, initial_delay=2.0)
    def write_invoices(
        self,
        invoices: List[InvoiceData],
        append: bool = True,
        include_line_items: bool = False,
        skip_duplicates: bool = True,
        batch_size: int = 75,
    ) -> Dict[str, Any]:
        """Write invoices to sheet with Phoenix Protocol retry logic.
        
        Phoenix Protocol features:
        - Auto-retry on network errors (5 attempts, exponential backoff)
        - Checkpoint state before batch write
        - Duplicate detection via invoice_no
        - Batch optimization (50-100 rows per batch)
        
        Args:
            invoices: List of invoice objects
            append: If True, append to sheet; if False, replace content
            include_line_items: Include line items in output
            skip_duplicates: Skip invoices already in sheet (duplicate detection)
            batch_size: Number of rows per batch write (default 75, optimal: 50-100)
            
        Returns:
            Success/error status with row count and duplicate info
        """
        try:
            # Phoenix Protocol: Save checkpoint
            checkpoint = get_checkpoint()
            checkpoint.save("write_invoices_start", {
                "count": len(invoices),
                "append": append,
                "timestamp": datetime.now().isoformat(),
            })
            
            # Duplicate detection
            filtered_invoices, duplicates = self._filter_duplicates(
                invoices, 
                skip_duplicates=skip_duplicates
            )
            
            if not filtered_invoices:
                logger.warning("No invoices to write after duplicate filtering")
                return {
                    "success": True,
                    "row_count": 0,
                    "duplicates_skipped": len(duplicates),
                    "duplicate_invoice_nos": duplicates,
                    "sheet": self.config.sheet_name,
                    "timestamp": datetime.now().isoformat(),
                }
            
            headers = self._get_headers(include_line_items)
            rows = [headers]
            rows.extend([
                self._invoice_to_row(inv, include_line_items)
                for inv in filtered_invoices
            ])

            # Check if sheet has content
            existing_values = self.worksheet.get_all_values()

            if append and existing_values:
                # Append mode with batch optimization
                data_rows = rows[1:]  # Skip header
                
                # Batch write for large datasets (50-100 rows optimal)
                if len(data_rows) > batch_size:
                    logger.info(f"Batch writing {len(data_rows)} rows in batches of {batch_size}")
                    
                    for i in range(0, len(data_rows), batch_size):
                        batch = data_rows[i:i + batch_size]
                        self.worksheet.append_rows(batch)
                        logger.debug(f"Wrote batch {i // batch_size + 1}: {len(batch)} rows")
                else:
                    # Small dataset, single write
                    self.worksheet.append_rows(data_rows)
            else:
                # Replace mode: clear and write all
                self.worksheet.clear()
                
                # Batch write for large datasets
                if len(rows) > batch_size:
                    logger.info(f"Batch writing {len(rows)} rows (with header) in batches of {batch_size}")
                    
                    # Write header first
                    self.worksheet.append_row(rows[0])
                    
                    # Batch write data rows
                    data_rows = rows[1:]
                    for i in range(0, len(data_rows), batch_size):
                        batch = data_rows[i:i + batch_size]
                        self.worksheet.append_rows(batch)
                        logger.debug(f"Wrote batch {i // batch_size + 1}: {len(batch)} rows")
                else:
                    # Small dataset, single write
                    self.worksheet.append_rows(rows)
            
            # Phoenix Protocol: Clear checkpoint on success
            checkpoint.clear("write_invoices_start")
            
            logger.info(
                f"[OK] Successfully wrote {len(filtered_invoices)} invoices "
                f"(skipped {len(duplicates)} duplicates)"
            )
            
            return {
                "success": True,
                "row_count": len(filtered_invoices),
                "duplicates_skipped": len(duplicates),
                "duplicate_invoice_nos": duplicates[:10],  # First 10 for logging
                "sheet": self.config.sheet_name,
                "timestamp": datetime.now().isoformat(),
                "batch_size": batch_size,
            }

        except Exception as e:
            # Phoenix Protocol: Log error and checkpoint state
            checkpoint_state = checkpoint.restore("write_invoices_start")
            logger.error(
                f"Phoenix Protocol: write_invoices failed "
                f"(checkpoint: {checkpoint_state})",
                exc_info=True
            )
            
            return {
                "success": False,
                "error": str(e),
                "sheet": self.config.sheet_name,
                "checkpoint": checkpoint_state,
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

    @retry_on_network_error(max_retries=3, initial_delay=1.0)
    def clear_sheet(self) -> Dict[str, Any]:
        """Clear all data from sheet (with Phoenix Protocol retry)."""
        try:
            self.worksheet.clear()
            logger.info(f"[OK] Sheet '{self.config.sheet_name}' cleared")
            return {
                "success": True,
                "message": f"Sheet '{self.config.sheet_name}' cleared",
            }
        except Exception as e:
            logger.error(f"Failed to clear sheet: {e}", exc_info=True)
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
