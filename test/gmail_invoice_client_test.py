"""
Unit tesztek a GmailInvoiceClient-hez (Phase 2: Gmail Fallback).

Teszteli:
1. Client inicializálás
2. Gmail instruction build
3. Result parsing
4. Connection test (mock)
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

# Gmail Invoice Client
try:
    from myai.clients.gmail_invoice_client import GmailInvoiceClient, GmailInvoiceError
    from myai.agents.robotkez_v2_hybrid import RobotkezResult
    HAS_CLIENT = True
except ImportError:
    HAS_CLIENT = False
    pytestmark = pytest.mark.skip(reason="GmailInvoiceClient not available")


@pytest.mark.skipif(not HAS_CLIENT, reason="GmailInvoiceClient not available")
class TestGmailInvoiceClient:
    """Gmail Invoice Client unit tesztek."""

    def test_client_initialization(self):
        """Kliens inicializálás credentials nélkül."""
        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_password",
            headless=True,
        )

        assert client.gmail_email == "test@gmail.com"
        assert client.gmail_password == "test_password"
        assert client.headless == True
        assert client.download_dir == Path("./data/invoices/gmail")


    def test_build_gmail_instruction(self):
        """Gmail instruction generálás."""
        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
        )

        instruction = client._build_gmail_instruction(days_back=30, max_emails=50)

        assert "test@gmail.com" in instruction
        assert "test_pass" in instruction
        assert "szamlazz.hu" in instruction  #default search_from
        assert "számla" in instruction  # default search_subject
        assert "50 emails" in instruction
        # Check for download dir (handle both Windows and Unix paths)
        assert "invoices" in instruction and "gmail" in instruction


    def test_parse_robotkez_result_list(self):
        """Robotkéz result parsing - lista formátum."""
        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
        )

        # Mock result with list of files
        mock_result = Mock(spec=RobotkezResult)
        mock_result.success = True
        mock_result.result = [
            {
                "filename": "invoice_001.pdf",
                "path": "/tmp/invoice_001.pdf",
                "email_subject": "Új számla - XYZ",
                "email_from": "szamlazz.hu",
                "email_date": "2026-02-17",
            },
            {
                "filename": "invoice_002.pdf",
                "path": "/tmp/invoice_002.pdf",
                "email_subject": "Új számla - ABC",
                "email_from": "szamlazz.hu",
                "email_date": "2026-02-16",
            },
        ]

        files = client._parse_robotkez_result(mock_result)

        assert len(files) == 2
        assert files[0]["filename"] == "invoice_001.pdf"
        assert files[0]["source"] == "gmail"
        assert files[1]["email_from"] == "szamlazz.hu"


    def test_parse_robotkez_result_dict(self):
        """Robotkéz result parsing - dict formátum."""
        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
        )

        mock_result = Mock(spec=RobotkezResult)
        mock_result.success = True
        mock_result.result = {
            "files": [
                {"filename": "invoice_001.pdf", "path": "/tmp/invoice_001.pdf"},
            ]
        }

        files = client._parse_robotkez_result(mock_result)

        assert len(files) == 1
        assert files[0]["filename"] == "invoice_001.pdf"
        assert files[0]["source"] == "gmail"


    def test_parse_robotkez_result_simple_strings(self):
        """Robotkéz result parsing - egyszerű filename stringek."""
        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
        )

        mock_result = Mock(spec=RobotkezResult)
        mock_result.success = True
        mock_result.result = [
            "invoice_001.pdf",
            "invoice_002.pdf",
        ]

        files = client._parse_robotkez_result(mock_result)

        assert len(files) == 2
        assert files[0]["filename"] == "invoice_001.pdf"
        assert files[0]["source"] == "gmail"
        assert "downloaded_at" in files[0]


    @pytest.mark.anyio
    @patch("myai.clients.gmail_invoice_client.RobotkezV2")
    async def test_fetch_invoice_pdfs_success(self, mock_robotkez_class):
        """Fetch invoice PDFs - sikeres futás (mock)."""
        # Mock RobotkezV2 instance
        mock_robot = AsyncMock()
        mock_robotkez_class.return_value = mock_robot

        # Mock execute result
        mock_result = Mock(spec=RobotkezResult)
        mock_result.success = True
        mock_result.result = [
            {
                "filename": "test_invoice.pdf",
                "path": "/tmp/test_invoice.pdf",
                "email_subject": "Test Invoice",
                "email_from": "test@example.com",
            }
        ]
        mock_robot.execute.return_value = mock_result

        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
        )

        files = await client.fetch_invoice_pdfs(days_back=30, max_emails=10)

        assert len(files) == 1
        assert files[0]["filename"] == "test_invoice.pdf"
        assert files[0]["source"] == "gmail"
        mock_robot.execute.assert_called_once()


    @pytest.mark.anyio
    @patch("myai.clients.gmail_invoice_client.RobotkezV2")
    async def test_fetch_invoice_pdfs_failure(self, mock_robotkez_class):
        """Fetch invoice PDFs - hiba kezelés (mock)."""
        mock_robot = AsyncMock()
        mock_robotkez_class.return_value = mock_robot

        # Mock failed result
        mock_result = Mock(spec=RobotkezResult)
        mock_result.success = False
        mock_result.error = "Browser automation failed"
        mock_robot.execute.return_value = mock_result

        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
        )

        with pytest.raises(GmailInvoiceError, match="Robotkéz execution failed"):
            await client.fetch_invoice_pdfs(days_back=30, max_emails=10)


    @pytest.mark.anyio
    @patch("myai.clients.gmail_invoice_client.RobotkezV2")
    async def test_test_connection_success(self, mock_robotkez_class):
        """Test connection - sikeres (mock)."""
        mock_robot = AsyncMock()
        mock_robotkez_class.return_value = mock_robot

        mock_result = Mock(spec=RobotkezResult)
        mock_result.success = True
        mock_robot.execute.return_value = mock_result

        client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
        )

        result = await client.test_connection()

        assert result is True
        mock_robot.execute.assert_called_once()


    def test_no_credentials_warning(self):
        """Credentials nélküli inicializálás - warning log."""
        with patch.dict("os.environ", {}, clear=True):
            # Clear env vars
            _client = GmailInvoiceClient()
            
            # Client létrejön, de warningot kell adnia
            assert _client.gmail_email == ""
            assert _client.gmail_password == ""


    def test_download_directory_creation(self, tmp_path):
        """Download directory automatikus létrehozása."""
        download_dir = tmp_path / "test_invoices"
        
        _client = GmailInvoiceClient(
            gmail_email="test@gmail.com",
            gmail_password="test_pass",
            download_dir=str(download_dir),
        )

        assert download_dir.exists()
        assert download_dir.is_dir()


# Integration test (skip by default - requires real credentials)
@pytest.mark.skip(reason="Integration test - requires real Gmail credentials")
@pytest.mark.anyio
async def test_real_gmail_connection():
    """
    INTEGRATION TEST - Real Gmail connection test.
    
    Requirements:
    - .env: GMAIL_EMAIL, GMAIL_APP_PASSWORD
    - Valid credentials
    """
    client = GmailInvoiceClient()
    
    # Test connection
    connected = await client.test_connection()
    assert connected is True
    
    # Fetch invoices (last 7 days)
    files = await client.fetch_invoice_pdfs(days_back=7, max_emails=5)
    
    assert isinstance(files, list)
    print(f"Downloaded {len(files)} invoice PDFs from Gmail")
