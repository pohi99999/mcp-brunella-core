"""Tests for Google Sheets Client - Phase 4 Features

Tests for:
- Phoenix Protocol retry logic
- Duplicate detection
- Batch write optimization (50-100 rows)
- Enhanced write_invoices with skip_duplicates
"""

import pytest
from unittest.mock import Mock, MagicMock, patch, call
from datetime import date
from myai.clients.google_sheets_client import GoogleSheetsClient, SheetsConfig
from myai.schemas.invoice import InvoiceData


@pytest.fixture
def mock_sheets_client():
    """Mock Google Sheets client for testing."""
    with patch('myai.clients.google_sheets_client.service_account'):
        with patch('myai.clients.google_sheets_client.gspread.authorize') as mock_auth:
            # Mock spreadsheet and worksheet
            mock_worksheet = MagicMock()
            mock_worksheet.get_all_values.return_value = []
            mock_worksheet.append_rows = MagicMock()
            mock_worksheet.append_row = MagicMock()
            mock_worksheet.clear = MagicMock()
            
            mock_spreadsheet = MagicMock()
            mock_spreadsheet.worksheet.return_value = mock_worksheet
            mock_spreadsheet.metadata = {"title": "Test Sheet"}
            
            mock_client = MagicMock()
            mock_client.open_by_key.return_value = mock_spreadsheet
            
            mock_auth.return_value = mock_client
            
            config = SheetsConfig(
                spreadsheet_id="test_sheet_id",
                sheet_name="TestSheet",
                credentials_json='{"type": "service_account", "project_id": "test"}',
            )
            
            client = GoogleSheetsClient(config)
            client.worksheet = mock_worksheet
            
            yield client


@pytest.fixture
def sample_invoices():
    """Sample invoice data for testing."""
    return [
        InvoiceData(
            partner="Company A",
            amount=10000,
            vat_amount=2700,
            invoice_no="2026-001",
            invoice_date=date(2026, 2, 1),
            due_date=date(2026, 3, 1),
            description="January services",
        ),
        InvoiceData(
            partner="Company B",
            amount=20000,
            vat_amount=5400,
            invoice_no="2026-002",
            invoice_date=date(2026, 2, 5),
            due_date=date(2026, 3, 5),
            description="Consulting fees",
        ),
        InvoiceData(
            partner="Company C",
            amount=15000,
            vat_amount=4050,
            invoice_no="2026-003",
            invoice_date=date(2026, 2, 10),
            due_date=date(2026, 3, 10),
            description="Software license",
        ),
    ]


class TestPhoenixProtocolRetry:
    """Tests for Phoenix Protocol retry logic in GoogleSheetsClient."""
    
    @pytest.mark.skip(reason="Phoenix Protocol retry tested in phoenix_protocol_test.py")
    def test_write_invoices_retries_on_network_error(self, mock_sheets_client, sample_invoices):
        """Phoenix Protocol retry is tested separately in phoenix_protocol_test.py."""
        pass
    
    def test_write_invoices_fails_after_max_retries(self, mock_sheets_client, sample_invoices):
        """Should fail after max retries exhausted."""
        # Permanent network error
        mock_sheets_client.worksheet.append_rows.side_effect = ConnectionError("Permanent error")
        
        # Phoenix Protocol should retry 5 times by default
        with patch('myai.utils.phoenix_protocol.logger'):
            result = mock_sheets_client.write_invoices(sample_invoices)
        
        # Should return error response (not raise exception)
        assert result["success"] is False
        assert "error" in result
    
    @pytest.mark.skip(reason="Phoenix Protocol retry tested in phoenix_protocol_test.py")
    def test_clear_sheet_retries_on_timeout(self, mock_sheets_client):
        """Phoenix Protocol retry is tested separately in phoenix_protocol_test.py."""
        pass


class TestDuplicateDetection:
    """Tests for duplicate invoice detection."""
    
    def test_filter_duplicates_basic(self, mock_sheets_client, sample_invoices):
        """Should filter out duplicate invoices by invoice_no."""
        # Existing sheet has invoice 2026-001
        mock_sheets_client.worksheet.get_all_values.return_value = [
            ["Invoice No", "Date", "Partner", "Amount"],
            ["2026-001", "2026-02-01", "Company A", "12700"],
        ]
        
        result = mock_sheets_client.write_invoices(
            sample_invoices,
            skip_duplicates=True
        )
        
        assert result["success"] is True
        assert result["row_count"] == 2  # Only 2 new invoices (2026-002, 2026-003)
        assert result["duplicates_skipped"] == 1
        assert "2026-001" in result["duplicate_invoice_nos"]
    
    def test_filter_duplicates_disabled(self, mock_sheets_client, sample_invoices):
        """Should not filter duplicates when skip_duplicates=False."""
        # Existing sheet has invoice 2026-001
        mock_sheets_client.worksheet.get_all_values.return_value = [
            ["Invoice No", "Date", "Partner", "Amount"],
            ["2026-001", "2026-02-01", "Company A", "12700"],
        ]
        
        result = mock_sheets_client.write_invoices(
            sample_invoices,
            skip_duplicates=False
        )
        
        assert result["success"] is True
        assert result["row_count"] == 3  # All 3 invoices written
        assert result["duplicates_skipped"] == 0
    
    def test_all_duplicates_filtered(self, mock_sheets_client, sample_invoices):
        """Should return early if all invoices are duplicates."""
        # All invoices already exist
        mock_sheets_client.worksheet.get_all_values.return_value = [
            ["Invoice No", "Date", "Partner", "Amount"],
            ["2026-001", "2026-02-01", "Company A", "12700"],
            ["2026-002", "2026-02-05", "Company B", "25400"],
            ["2026-003", "2026-02-10", "Company C", "19050"],
        ]
        
        result = mock_sheets_client.write_invoices(
            sample_invoices,
            skip_duplicates=True
        )
        
        assert result["success"] is True
        assert result["row_count"] == 0
        assert result["duplicates_skipped"] == 3
    
    def test_get_existing_invoice_numbers(self, mock_sheets_client):
        """Should correctly extract existing invoice numbers."""
        mock_sheets_client.worksheet.get_all_values.return_value = [
            ["Invoice No", "Date", "Partner"],
            ["2026-001", "2026-02-01", "Company A"],
            ["2026-005", "2026-02-05", "Company B"],
            ["", "", ""],  # Empty row should be ignored
        ]
        
        existing = mock_sheets_client._get_existing_invoice_numbers()
        
        assert existing == {"2026-001", "2026-005"}
    
    def test_empty_sheet_no_duplicates(self, mock_sheets_client, sample_invoices):
        """Should handle empty sheet (no existing invoices)."""
        mock_sheets_client.worksheet.get_all_values.return_value = []
        
        result = mock_sheets_client.write_invoices(
            sample_invoices,
            skip_duplicates=True
        )
        
        assert result["success"] is True
        assert result["row_count"] == 3
        assert result["duplicates_skipped"] == 0


class TestBatchOptimization:
    """Tests for batch write optimization (50-100 rows)."""
    
    def test_small_dataset_single_write(self, mock_sheets_client):
        """Should use single write for small datasets."""
        # Less than batch_size invoices
        small_set = [
            InvoiceData(
                partner=f"Company {i}",
                amount=10000,
                vat_amount=2700,
                invoice_no=f"2026-{i:03d}",
                invoice_date=date(2026, 2, 1),
                due_date=date(2026, 3, 1),
            )
            for i in range(10)
        ]
        
        result = mock_sheets_client.write_invoices(small_set, batch_size=75)
        
        assert result["success"] is True
        # Should call append_rows once (small dataset)
        assert mock_sheets_client.worksheet.append_rows.call_count == 1
    
    def test_large_dataset_batch_write(self, mock_sheets_client):
        """Should use batched writes for large datasets."""
        # More than batch_size invoices
        large_set = [
            InvoiceData(
                partner=f"Company {i}",
                amount=10000,
                vat_amount=2700,
                invoice_no=f"2026-{i:04d}",
                invoice_date=date(2026, 2, 1),
                due_date=date(2026, 3, 1),
            )
            for i in range(150)  # 150 invoices > batch_size 75
        ]
        
        result = mock_sheets_client.write_invoices(large_set, batch_size=75)
        
        assert result["success"] is True
        # Should call append_rows 2 times (150 / 75 = 2 batches)
        assert mock_sheets_client.worksheet.append_rows.call_count == 2
    
    def test_custom_batch_size(self, mock_sheets_client):
        """Should respect custom batch_size parameter."""
        invoices = [
            InvoiceData(
                partner=f"Company {i}",
                amount=10000,
                vat_amount=2700,
                invoice_no=f"2026-{i:04d}",
                invoice_date=date(2026, 2, 1),
                due_date=date(2026, 3, 1),
            )
            for i in range(100)
        ]
        
        result = mock_sheets_client.write_invoices(invoices, batch_size=50)
        
        assert result["success"] is True
        assert result["batch_size"] == 50
        # Should call append_rows 2 times (100 / 50 = 2 batches)
        assert mock_sheets_client.worksheet.append_rows.call_count == 2


class TestEnhancedWriteInvoices:
    """Tests for enhanced write_invoices with all Phase 4 features."""
    
    def test_combined_features(self, mock_sheets_client):
        """Should combine duplicate detection + batch write correctly."""
        # Existing invoice: 2026-001
        mock_sheets_client.worksheet.get_all_values.return_value = [
            ["Invoice No", "Date", "Partner"],
            ["2026-001", "2026-02-01", "Company A"],
        ]
        
        # New invoices (including one duplicate)
        invoices = [
            InvoiceData(
                partner="Company A",
                amount=10000,
                vat_amount=2700,
                invoice_no="2026-001",  # Duplicate
                invoice_date=date(2026, 2, 1),
                due_date=date(2026, 3, 1),
            ),
        ] + [
            InvoiceData(
                partner=f"Company {i}",
                amount=10000,
                vat_amount=2700,
                invoice_no=f"2026-{i:04d}",
                invoice_date=date(2026, 2, 1),
                due_date=date(2026, 3, 1),
            )
            for i in range(2, 102)  # 100 new invoices
        ]
        
        result = mock_sheets_client.write_invoices(
            invoices,
            skip_duplicates=True,
            batch_size=50
        )
        
        assert result["success"] is True
        assert result["row_count"] == 100  # 101 total - 1 duplicate
        assert result["duplicates_skipped"] == 1
        assert result["batch_size"] == 50
        # Should use batch write (100 rows / 50 = 2 batches)
        assert mock_sheets_client.worksheet.append_rows.call_count == 2
    
    def test_result_metadata(self, mock_sheets_client, sample_invoices):
        """Should include comprehensive metadata in result."""
        result = mock_sheets_client.write_invoices(sample_invoices)
        
        assert "success" in result
        assert "row_count" in result
        assert "duplicates_skipped" in result
        assert "duplicate_invoice_nos" in result
        assert "sheet" in result
        assert "timestamp" in result
        assert "batch_size" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
