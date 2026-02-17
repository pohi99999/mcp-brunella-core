"""
Unit tesztek a Számlázz.hu API kliens számára.
"""

import pytest
from datetime import date
from unittest.mock import patch, MagicMock

from myai.clients.szamlazz_hu_client import SzamlazzHuClient, SzamlazzHuError
from myai.schemas.invoice import InvoiceData


class TestSzamlazzHuClient:
    """Számlázz.hu kliens tesztek."""

    @pytest.fixture
    def client(self):
        """Teszt kliens fixture."""
        return SzamlazzHuClient(
            api_key="test_key_12345",
            account_id="test_account",
        )

    @pytest.fixture
    def sample_api_response(self):
        """Minta API válasz."""
        return {
            "invoices": [
                {
                    "id": "INV-2026-001",
                    "invoiceNumber": "2026-001",
                    "customerName": "Test Company Ltd.",
                    "netAmount": 100000.00,
                    "vatAmount": 27000.00,
                    "vatRate": 27.0,
                    "invoiceDate": "2026-02-14",
                    "dueDate": "2026-03-14",
                    "status": "unpaid",
                    "currency": "HUF",
                    "notes": "Test invoice",
                },
                {
                    "id": "INV-2026-002",
                    "invoiceNumber": "2026-002",
                    "customerName": "Another Corp",
                    "netAmount": 50000.00,
                    "vatAmount": 13500.00,
                    "vatRate": 27.0,
                    "invoiceDate": "2026-02-15",
                    "dueDate": "2026-03-15",
                    "status": "paid",
                    "currency": "HUF",
                    "notes": "",
                },
            ]
        }

    def test_client_initialization(self):
        """Kliens inicalizáció teszt."""
        client = SzamlazzHuClient(
            api_key="test_key",
            account_id="test_account",
        )
        assert client.api_key == "test_key"
        assert client.account_id == "test_account"
        assert client.base_url == "https://api.szamlazz.hu"

    def test_parse_date_yyyy_mm_dd(self):
        """Dátum parsálás YYYY-MM-DD formátumban."""
        result = SzamlazzHuClient._parse_date("2026-02-14")
        assert result == date(2026, 2, 14)

    def test_parse_date_dd_mm_yyyy(self):
        """Dátum parsálás DD.MM.YYYY (magyar) formátumban."""
        result = SzamlazzHuClient._parse_date("14.02.2026")
        assert result == date(2026, 2, 14)

    def test_parse_date_invalid(self):
        """Érvénytelen dátum parsálása."""
        result = SzamlazzHuClient._parse_date("invalid-date")
        assert result is None

    def test_map_payment_status(self):
        """Status leképezés teszt."""
        assert SzamlazzHuClient._map_payment_status("unpaid") == "pending"
        assert SzamlazzHuClient._map_payment_status("paid") == "paid"
        assert SzamlazzHuClient._map_payment_status("partially_paid") == "partial"
        assert SzamlazzHuClient._map_payment_status("overdue") == "overdue"
        assert SzamlazzHuClient._map_payment_status("cancelled") == "cancelled"

    def test_convert_to_invoice_data(self, client, sample_api_response):
        """API válasz konvertálása InvoiceData-ra."""
        api_invoice = sample_api_response["invoices"][0]
        invoice = client._convert_to_invoice_data(api_invoice)
        
        assert invoice is not None
        assert isinstance(invoice, InvoiceData)
        assert invoice.partner == "Test Company Ltd."
        assert invoice.amount == 100000.00
        assert invoice.vat_amount == 27000.00
        assert invoice.total_amount == 127000.00
        assert invoice.payment_status == "pending"
        assert invoice.source == "szamlazz_api"

    @patch("myai.clients.szamlazz_hu_client.requests.Session.get")
    def test_get_invoices_success(self, mock_get, client, sample_api_response):
        """Sikeres számlák lekérése."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_api_response
        mock_get.return_value = mock_response
        
        invoices = client.get_invoices()
        
        assert len(invoices) == 2
        assert invoices[0].partner == "Test Company Ltd."
        assert invoices[1].partner == "Another Corp"

    @patch("myai.clients.szamlazz_hu_client.requests.Session.get")
    def test_get_invoices_api_error(self, mock_get, client):
        """API hiba kezelése."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"error": {"message": "Unauthorized"}}
        mock_get.return_value = mock_response
        
        with pytest.raises(SzamlazzHuError):
            client.get_invoices()

    @patch("myai.clients.szamlazz_hu_client.requests.Session.get")
    def test_test_connection_success(self, mock_get, client):
        """Kapcsolat tesztelés - sikeres."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        assert client.test_connection() is True

    def test_no_api_key(self):
        """API key nélküli kliens kezelése."""
        client = SzamlazzHuClient(api_key="")
        invoices = client.get_invoices()
        
        assert invoices == []
