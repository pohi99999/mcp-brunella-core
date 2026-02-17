"""
Számlázz.hu API kliens - Invoice adatok lekéréséhez.

Integráció a számlázz.hu weboldallal: https://szamlazz.hu/
API dokumentáció: https://szamlazz.hu/api
"""

import os
import logging
import asyncio
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
            logger.warning("Számlázz.hu API key nem beállított")

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
            "Content-Type": "application/json",
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

        msg = f"Számlázz.hu API hiba ({context}): [{response.status_code}] {error_msg}"
        logger.error(msg)
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
                logger.warning(f"Érvénytelen dátumok a számlán: {api_invoice.get('id')}")
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
            logger.error(f"Hiba az invoice konvertálásakor: {e}")
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

        logger.warning(f"Nem lehet parsálni a dátumot: {date_str}")
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
            logger.error("API key nincs beállítva")
            return []

        endpoint = f"{self.base_url}/invoices"
        params = {"limit": limit}

        try:
            logger.info(f"Számlák lekérése: {endpoint}")
            response = self.session.get(
                endpoint,
                params=params,
                timeout=self.timeout,
            )

            if response.status_code != 200:
                self._handle_error(response, "get_invoices")

            data = response.json()
            invoices = data.get("invoices", [])

            logger.info(f"{len(invoices)} számla lekérve az API-ból")

            # Konvertálás InvoiceData listára
            result = []
            for api_invoice in invoices:
                invoice = self._convert_to_invoice_data(api_invoice)
                if invoice:
                    result.append(invoice)

            return result

        except requests.RequestException as e:
            logger.error(f"Network hiba a számlák lekérésekor: {e}")
            raise SzamlazzHuError(f"Network hiba: {e}")

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
            logger.error("API key nincs beállítva")
            return []

        endpoint = f"{self.base_url}/invoices"
        params = {
            "dateFrom": since_date.isoformat(),
            "limit": 100,
        }

        try:
            logger.info(f"Számlák lekérése: {since_date} óta")
            response = self.session.get(
                endpoint,
                params=params,
                timeout=self.timeout,
            )

            if response.status_code != 200:
                self._handle_error(response, "get_invoices_since")

            data = response.json()
            invoices = data.get("invoices", [])

            logger.info(f"{len(invoices)} számla lekérve {since_date} óta")

            result = []
            for api_invoice in invoices:
                invoice = self._convert_to_invoice_data(api_invoice)
                if invoice:
                    result.append(invoice)

            return result

        except requests.RequestException as e:
            logger.error(f"Network hiba: {e}")
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
            logger.error("API key nincs beállítva")
            return None

        endpoint = f"{self.base_url}/invoices/{invoice_id}"

        try:
            logger.info(f"Számla lekérése: {invoice_id}")
            response = self.session.get(
                endpoint,
                timeout=self.timeout,
            )

            if response.status_code == 404:
                logger.warning(f"Számla nem található: {invoice_id}")
                return None

            if response.status_code != 200:
                self._handle_error(response, f"get_invoice_by_id({invoice_id})")

            api_invoice = response.json()
            invoice = self._convert_to_invoice_data(api_invoice)

            return invoice

        except requests.RequestException as e:
            logger.error(f"Network hiba: {e}")
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
            logger.error("API key nincs beállítva")
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
                        logger.error(f"API hiba: {response.status}")
                        return []

                    data = await response.json()
                    invoices = data.get("invoices", [])

                    result = []
                    for api_invoice in invoices:
                        invoice = self._convert_to_invoice_data(api_invoice)
                        if invoice:
                            result.append(invoice)

                    logger.info(f"{len(result)} számla lekérve async módon")
                    return result

        except asyncio.TimeoutError:
            logger.error("Request timeout az async lekéréskor")
            return []
        except aiohttp.ClientError as e:
            logger.error(f"Async hiba: {e}")
            return []

    def test_connection(self) -> bool:
        """
        API kapcsolat tesztelése.
        
        Returns:
            True ha a kapcsolat működik, False egyébként
        """
        if not self.api_key:
            logger.error("API key nincs beállítva")
            return False

        endpoint = f"{self.base_url}/health"

        try:
            response = self.session.get(endpoint, timeout=5)
            is_ok = response.status_code == 200
            
            if is_ok:
                logger.info("Számlázz.hu API elérhető")
            else:
                logger.warning(f"Számlázz.hu API nem elérhető: {response.status_code}")
            
            return is_ok

        except requests.RequestException as e:
            logger.error(f"Kapcsolat tesztelés sikertelen: {e}")
            return False

    def __repr__(self) -> str:
        return f"SzamlazzHuClient(base_url={self.base_url}, account_id={self.account_id})"
