"""
Számlázz.hu API kliens - Invoice adatok lekéréséhez.

Integráció a számlázz.hu weboldallal: https://szamlazz.hu/
API dokumentáció: https://szamlazz.hu/api
"""

import os
import logging
import asyncio
import base64
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import asdict

import aiohttp
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from myai.schemas.invoice import InvoiceData

# Logger beállítása
logger = logging.getLogger(__name__)


class SzamlazzHuError(Exception):
    """Számlázz.hu API hiba."""
    pass


class SzamlazzHuClient:
    """
    Számlázz.hu API kliens.
    
    Lekéri a számlákat az API-ből és InvoiceData objektumokra konvertálja őket.
    
    Attributes:
        api_key (str): API kulcs a számlázz.hu-hoz
        account_id (str): Számla szervezet ID
        base_url (str): API alap URL
        timeout (int): Request timeout másodpercben
        max_retries (int): Maximum próbálkozások száma
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        account_id: Optional[str] = None,
        base_url: str = "https://api.szamlazz.hu",
        timeout: int = 30,
        max_retries: int = 3,
    ):
        """
        Inicializálás.
        
        Args:
            api_key: API kulcs (env: SZAMLAZZ_HU_API_KEY)
            account_id: Számla szervezet ID (env: SZAMLAZZ_HU_ACCOUNT_ID)
            base_url: API alap URL
            timeout: Request timeout másodpercben
            max_retries: Maximum próbálkozások száma
        """
        self.api_key = api_key or os.getenv("SZAMLAZZ_HU_API_KEY", "")
        self.account_id = account_id or os.getenv("SZAMLAZZ_HU_ACCOUNT_ID", "")
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries

        if not self.api_key:
            logger.warning("[WARN] Szamlazz.hu API key nincs beallitva")

        # Session beállítása retry logikával
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        # Headers beállítása
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "BrunellaInvoiceAutomation/1.0",
        })

    def _handle_error(self, response: requests.Response, context: str) -> None:
        """
        Hiba kezelése.
        
        Args:
            response: HTTP response
            context: Kontextus (pl. "get_invoices")
            
        Raises:
            SzamlazzHuError: Ha hiba van az API-ben
        """
        try:
            error_data = response.json()
            error_msg = error_data.get("error", {}).get("message", response.text)
        except ValueError:
            error_msg = response.text

        msg = f"Szamlazz.hu API hiba ({context}): [{response.status_code}] {error_msg}"
        logger.error(f"[ERROR] {msg}")
        raise SzamlazzHuError(msg)

    def _convert_to_invoice_data(self, api_invoice: Dict[str, Any]) -> Optional[InvoiceData]:
        """
        Számlázz.hu API válasz konvertálása InvoiceData objektumra.
        
        Args:
            api_invoice: API-ből kapott számla adat
            
        Returns:
            InvoiceData objektum vagy None ha hiba
        """
        try:
            # API mezők leképezése InvoiceData sémára
            # (A tényleges mezőnevek a Számlázz.hu API dokumentációtól függenek)
            
            invoice_date = self._parse_date(api_invoice.get("invoiceDate"))
            due_date = self._parse_date(api_invoice.get("dueDate"))
            
            if not invoice_date or not due_date:
                logger.warning(f"[WARN] Ervenytelen datumok a szamlan: {api_invoice.get('id')}")
                return None

            # Összegek kezelése
            amount = float(api_invoice.get("netAmount", 0))
            vat_amount = float(api_invoice.get("vatAmount", 0))
            vat_rate = float(api_invoice.get("vatRate", 27.0))

            # Status leképezése
            payment_status = self._map_payment_status(api_invoice.get("status", ""))

            invoice_data = InvoiceData(
                partner=api_invoice.get("customerName", "Unknown"),
                amount=amount,
                vat_amount=vat_amount,
                vat_rate=vat_rate,
                invoice_date=invoice_date,
                due_date=due_date,
                invoice_no=api_invoice.get("invoiceNumber", ""),
                total_amount=amount + vat_amount,
                description=api_invoice.get("notes", ""),
                currency=api_invoice.get("currency", "HUF"),
                payment_status=payment_status,
                source="szamlazz_api",
            )

            return invoice_data

        except (ValueError, KeyError) as e:
            logger.error(f"[ERROR] Hiba az invoice konvertalasakor: {e}")
            return None

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> Optional[date]:
        """
        Dátum string parsálása.
        
        Támogatott formátumok:
        - YYYY-MM-DD
        - YYYY/MM/DD
        - DD.MM.YYYY (magyar)
        
        Args:
            date_str: Dátum string
            
        Returns:
            date objektum vagy None
        """
        if not date_str:
            return None

        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d.%m.%Y",
            "%d/%m/%Y",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue

        logger.warning(f"[WARN] Nem lehet parsali a datumot: {date_str}")
        return None

    @staticmethod
    def _map_payment_status(api_status: str) -> str:
        """
        Számlázz.hu status leképezése standard statusokra.
        
        Args:
            api_status: Status az API-ből
            
        Returns:
            Standard status (pending, paid, overdue, cancelled, partial)
        """
        status_map = {
            "draft": "pending",
            "sent": "pending",
            "viewed": "pending",
            "paid": "paid",
            "partially_paid": "partial",
            "overdue": "overdue",
            "cancelled": "cancelled",
            "unpaid": "pending",
        }
        return status_map.get(api_status.lower(), "pending")

    def get_invoices(self, limit: int = 100) -> List[InvoiceData]:
        """
        Összes számla lekérése.
        
        Args:
            limit: Maximum sorszám (default: 100)
            
        Returns:
            InvoiceData objektumok listája
            
        Raises:
            SzamlazzHuError: Ha hiba az API-ben
        """
        if not self.api_key:
            logger.error("[ERROR] API key nincs beallitva")
            return []

        endpoint = f"{self.base_url}/invoices"
        params = {"limit": limit}

        try:
            logger.info(f"[OK] Szamlak lekerese: {endpoint}")
            response = self.session.get(
                endpoint,
                params=params,
                timeout=self.timeout,
            )

            if response.status_code != 200:
                self._handle_error(response, "get_invoices")

            data = response.json()
            invoices = data.get("invoices", [])

            logger.info(f"[OK] {len(invoices)} szamla lekerve az API-bol")

            # Konvertálás InvoiceData listára
            result = []
            for api_invoice in invoices:
                invoice = self._convert_to_invoice_data(api_invoice)
                if invoice:
                    result.append(invoice)

            return result

        except requests.RequestException as e:
            logger.error(f"[ERROR] Network hiba a szamlak lekeresekor: {e}")
            raise SzamlazzHuError(f"Network hiba: {e}")

    def send_invoice(self, xml_payload: str) -> Dict[str, Any]:
        """
        Számla létrehozása XML payload alapján.

        Args:
            xml_payload: Számlázz.hu XML kérés tartalma

        Returns:
            A küldés eredménye metadata-val és válasz tartalommal

        Raises:
            SzamlazzHuError: Ha az API hiba történik
        """
        if not self.api_key:
            logger.error("[ERROR] API key nincs beallitva")
            raise SzamlazzHuError("API key nincs beallitva")

        if not xml_payload or not xml_payload.strip():
            raise SzamlazzHuError("XML payload is required")

        endpoint = "https://www.szamlazz.hu/szamla/"
        headers = {
            key: value
            for key, value in self.session.headers.items()
            if key.lower() not in {"content-type", "authorization"}
        }
        files = {
            "action-xmlagentxmlfile": ("invoice.xml", xml_payload.encode("utf-8"), "application/xml"),
        }

        try:
            logger.info(f"[OK] Szamla kuldes inditasa: {endpoint}")
            response = self.session.post(
                endpoint,
                files=files,
                headers=headers,
                timeout=self.timeout,
            )

            content_type = response.headers.get("Content-Type", "")
            if response.status_code not in (200, 201):
                self._handle_error(response, "send_invoice")

            if "pdf" in content_type.lower() or response.content.startswith(b"%PDF"):
                logger.info("[OK] Szamla PDF valasz erkezett")
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "content_type": content_type,
                    "document_type": "pdf",
                    "response_base64": base64.b64encode(response.content).decode("ascii"),
                }

            logger.info("[OK] Szamla szoveges valasz erkezett")
            return {
                "success": True,
                "status_code": response.status_code,
                "content_type": content_type,
                "document_type": "text",
                "response_text": response.text,
            }

        except requests.RequestException as e:
            logger.error(f"[ERROR] Network hiba a szamla kuldesekor: {e}")
            raise SzamlazzHuError(f"Network hiba: {e}")

    def create_invoice(self, xml_payload: str) -> Dict[str, Any]:
        """Alias a számlaküldéshez."""
        return self.send_invoice(xml_payload)

    def get_invoices_since(self, since_date: date) -> List[InvoiceData]:
        """
        Számlák lekérése egy adott dátum óta.
        
        Args:
            since_date: Kezdő dátum (inclusive)
            
        Returns:
            InvoiceData objektumok listája
            
        Raises:
            SzamlazzHuError: Ha hiba az API-ben
        """
        if not self.api_key:
            logger.error("[ERROR] API key nincs beallitva")
            return []

        endpoint = f"{self.base_url}/invoices"
        params = {
            "dateFrom": since_date.isoformat(),
            "limit": 100,
        }

        try:
            logger.info(f"[OK] Szamlak lekerese: {since_date} ota")
            response = self.session.get(
                endpoint,
                params=params,
                timeout=self.timeout,
            )

            if response.status_code != 200:
                self._handle_error(response, "get_invoices_since")

            data = response.json()
            invoices = data.get("invoices", [])

            logger.info(f"[OK] {len(invoices)} szamla lekerve {since_date} ota")

            result = []
            for api_invoice in invoices:
                invoice = self._convert_to_invoice_data(api_invoice)
                if invoice:
                    result.append(invoice)

            return result

        except requests.RequestException as e:
            logger.error(f"[ERROR] Network hiba: {e}")
            raise SzamlazzHuError(f"Network hiba: {e}")

    def get_invoice_by_id(self, invoice_id: str) -> Optional[InvoiceData]:
        """
        Egy számla lekérése ID alapján.
        
        Args:
            invoice_id: Számla ID
            
        Returns:
            InvoiceData objektum vagy None
            
        Raises:
            SzamlazzHuError: Ha hiba az API-ben
        """
        if not self.api_key:
            logger.error("[ERROR] API key nincs beallitva")
            return None

        endpoint = f"{self.base_url}/invoices/{invoice_id}"

        try:
            logger.info(f"[OK] Szamla lekerese: {invoice_id}")
            response = self.session.get(
                endpoint,
                timeout=self.timeout,
            )

            if response.status_code == 404:
                logger.warning(f"[WARN] Szamla nem talalhato: {invoice_id}")
                return None

            if response.status_code != 200:
                self._handle_error(response, f"get_invoice_by_id({invoice_id})")

            api_invoice = response.json()
            invoice = self._convert_to_invoice_data(api_invoice)

            return invoice

        except requests.RequestException as e:
            logger.error(f"[ERROR] Network hiba: {e}")
            raise SzamlazzHuError(f"Network hiba: {e}")

    async def get_invoices_async(self, limit: int = 100) -> List[InvoiceData]:
        """
        Async verzió a számlák lekéréséhez.
        
        Args:
            limit: Maximum számlaszám
            
        Returns:
            InvoiceData objektumok listája
        """
        if not self.api_key:
            logger.error("[ERROR] API key nincs beallitva")
            return []

        endpoint = f"{self.base_url}/invoices"
        params = {"limit": limit}

        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                
                async with session.get(
                    endpoint,
                    params=params,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                ) as response:
                    
                    if response.status != 200:
                        logger.error(f"[ERROR] API hiba: {response.status}")
                        return []

                    data = await response.json()
                    invoices = data.get("invoices", [])

                    result = []
                    for api_invoice in invoices:
                        invoice = self._convert_to_invoice_data(api_invoice)
                        if invoice:
                            result.append(invoice)

                    logger.info(f"[OK] {len(result)} szamla lekerve async modon")
                    return result

        except asyncio.TimeoutError:
            logger.error("[ERROR] Request timeout az async lekereskor")
            return []
        except aiohttp.ClientError as e:
            logger.error(f"[ERROR] Async hiba: {e}")
            return []

    def test_connection(self) -> bool:
        """
        API kapcsolat tesztelése.
        
        Returns:
            True ha a kapcsolat működik, False egyébként
        """
        if not self.api_key:
            logger.error("[ERROR] API key nincs beallitva")
            return False

        endpoint = f"{self.base_url}/health"

        try:
            response = self.session.get(endpoint, timeout=5)
            is_ok = response.status_code == 200
            
            if is_ok:
                logger.info("[OK] Szamlazz.hu API elerheto")
            else:
                logger.warning(f"[WARN] Szamlazz.hu API nem elerheto: {response.status_code}")
            
            return is_ok

        except requests.RequestException as e:
            logger.error(f"[ERROR] Kapcsolat teszteles sikertelen: {e}")
            return False

    def __repr__(self) -> str:
        return f"SzamlazzHuClient(base_url={self.base_url}, account_id={self.account_id})"
