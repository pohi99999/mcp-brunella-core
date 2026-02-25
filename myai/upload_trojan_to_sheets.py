"""
🚀 Trojan-Horse Campaign — Google Sheets Feltöltő Script
=========================================================
Feltölti:
  1. fogorvosok_leads_CLEAN.csv (50 fogorvos) → "Fogorvosok" tab
  2. target_agencies.md (8 ügynökség)         → "Ügynökségek" tab
  3. Campaign tracking template               → "Campaign_Tracking" tab

Futtatás:
  cd f:\\mcp-brunella-core
  python myai/upload_trojan_to_sheets.py

Előfeltételek:
  pip install gspread google-auth google-auth-oauthlib google-auth-httplib2 pandas

Credentials elhelyezés:
  credentials/google-oauth2-credentials.json
    (= a client_secret_175738030631-....json, másold át ebbe a névbe)
"""

import os
import sys
import csv
import logging
import re
from pathlib import Path
from datetime import datetime
from io import StringIO

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ============================================================================
# KONFIGURÁCIÓ
# ============================================================================

SHEET_ID = "1Ja4sdeHs9mSJGJrPhwjnrUr2jNbcR63tJtH34qfHfLY"

# A script mindig az mcp-brunella-core gyökérhez képest keres
ROOT = Path(__file__).parent.parent
TRACK_DIR = ROOT / "conductor" / "tracks" / "trojan-horse-campaign-20260224"

CSV_FOGORVOSOK = TRACK_DIR / "fogorvosok_leads_CLEAN.csv"
MD_AGENCIES    = TRACK_DIR / "target_agencies.md"

# Credentials keresési sorrend:
CREDS_PATHS = [
    ROOT / "credentials" / "google-oauth2-credentials.json",
    Path.home() / "OneDrive" / "Desktop" / "client_secret_175738030631-rjnvdpqo5moa48coolo29kv5dbcrvi2m.apps.googleusercontent.com.json",
    Path.home() / "Desktop" / "client_secret_175738030631-rjnvdpqo5moa48coolo29kv5dbcrvi2m.apps.googleusercontent.com.json",
]

TOKEN_PATH = ROOT / "credentials" / "google-token.json"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# ============================================================================
# DEPENDENCY CHECK
# ============================================================================

def check_dependencies():
    missing = []
    for pkg in ["gspread", "google.auth", "pandas"]:
        try:
            __import__(pkg.replace(".", "_").split("_")[0])
        except ImportError:
            missing.append(pkg)
    if missing:
        logger.error(f"❌ Hiányzó csomagok: {missing}")
        logger.error("   Telepítés: pip install gspread google-auth google-auth-oauthlib google-auth-httplib2 pandas")
        sys.exit(1)

check_dependencies()

import gspread
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pandas as pd

# ============================================================================
# GOOGLE AUTH (OAuth2 — interaktív böngésző)
# ============================================================================

def find_credentials_file() -> Path:
    """Megkeresi az első létező credentials fájlt."""
    for path in CREDS_PATHS:
        if path.exists():
            logger.info(f"✅ Credentials megtalálva: {path}")
            return path
    logger.error("❌ Credentials fájl nem található!")
    logger.error("   Helyezd ide: credentials/google-oauth2-credentials.json")
    logger.error("   (= a Desktopról másolt client_secret_175738... fájl)")
    sys.exit(1)


def authenticate() -> gspread.Client:
    """OAuth2 auth — első futásnál böngészőt nyit, utána token-ből."""
    creds = None

    # Ha van már mentett token → betöltjük
    if TOKEN_PATH.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
            logger.info("✅ Token betöltve (cached)")
        except Exception:
            creds = None

    # Ha nincs vagy lejárt → frissítjük / újra autentikálunk
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("🔄 Token frissítése...")
            creds.refresh(Request())
        else:
            creds_file = find_credentials_file()
            logger.info("🌐 Böngésző megnyílik a Google belépéshez...")
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_file), SCOPES)
            creds = flow.run_local_server(port=0)

        # Token mentése következő futáshoz
        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
        logger.info(f"✅ Token elmentve: {TOKEN_PATH}")

    client = gspread.authorize(creds)
    logger.info("✅ Google Sheets hitelesítés OK")
    return client

# ============================================================================
# SHEET SETUP — TABOK LÉTREHOZÁSA
# ============================================================================

def setup_tabs(spreadsheet: gspread.Spreadsheet) -> dict:
    """Létrehozza a szükséges tabokat, ha nem léteznek."""
    tabs_needed = ["Fogorvosok", "Ügynökségek", "Campaign_Tracking"]
    existing = {ws.title: ws for ws in spreadsheet.worksheets()}
    worksheets = {}

    for tab_name in tabs_needed:
        if tab_name in existing:
            ws = existing[tab_name]
            ws.clear()
            worksheets[tab_name] = ws
            logger.info(f"  ♻️  Tab törölve/újra: {tab_name}")
        else:
            ws = spreadsheet.add_worksheet(title=tab_name, rows=500, cols=20)
            worksheets[tab_name] = ws
            logger.info(f"  ✅ Tab létrehozva: {tab_name}")

    # Ha van "Sheet1" vagy "Munka1" (alapértelmezett), töröljük
    for ws in spreadsheet.worksheets():
        if ws.title not in tabs_needed:
            try:
                spreadsheet.del_worksheet(ws)
                logger.info(f"  🗑️  Alap-tab törölve: {ws.title}")
            except Exception:
                pass  # Nem tudja törölni ha csak 1 sheet van — nem baj

    return worksheets

# ============================================================================
# CSV BEOLVASÁS + TISZTÍTÁS
# ============================================================================

def clean_value(val: str) -> str:
    """Kitisztít helytelen értékeket (false, URL szemét, stb.)"""
    if not isinstance(val, str):
        return str(val) if val else ""
    val = val.strip().strip('"\'')
    # Helytelen értékek cseréje üresre
    if val.lower() in ("false", "null", "none", "[]", ""):
        return ""
    # Google Maps URL-ek egyszerűsítése
    if val.startswith("https://lh3.googleusercontent.com"):
        return "(kép)"
    if val.startswith("https://streetviewpixels"):
        return "(utcakép)"
    if val.startswith("https://www.google.com/maps"):
        return "(Google Maps)"
    if val.startswith("/g/"):
        return ""
    # Hosszú URL-ek megtartása mint weboldal
    if val.startswith("http") and len(val) > 80:
        return val[:80] + "..."
    return val


def load_fogorvosok_csv(csv_path: Path) -> list[list]:
    """Beolvassa és tisztítja a CSV fájlt."""
    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)
        # Fejléc sor
        rows.append(["#"] + [h.strip() for h in headers] + ["Status", "Megjegyzés"])

        for i, row in enumerate(reader, 1):
            # CSV-ben a mezők: Cégnév, Email, Telefon, Weboldal, Értékelés, Cím
            # De az Apify export sajnos összekeverte az oszlopokat
            # Tisztítjuk:
            cleaned = [clean_value(v) for v in row]
            rows.append([str(i)] + cleaned + ["pending", ""])

    logger.info(f"  📊 Fogorvos sorok betöltve: {len(rows) - 1}")
    return rows


def load_agencies_md(md_path: Path) -> list[list]:
    """Beolvassa a target_agencies.md táblázatot."""
    rows = []
    headers_done = False

    with open(md_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or not line.startswith("|"):
                continue
            if "---" in line:
                continue  # Elválasztó sor

            cols = [c.strip() for c in line.split("|") if c.strip()]
            if not headers_done:
                rows.append(["#"] + cols + ["Email", "Status", "Küldve", "Válasz"])
                headers_done = True
            else:
                rows.append([str(len(rows))] + cols + ["", "pending", "", ""])

    logger.info(f"  📊 Ügynökség sorok betöltve: {len(rows) - 1}")
    return rows

# ============================================================================
# SHEET FELTÖLTÉS
# ============================================================================

def upload_fogorvosok(ws: gspread.Worksheet, rows: list[list]):
    """Feltölti a fogorvos adatokat + formázza."""
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    # Fejléc formázás
    ws.format("A1:K1", {
        "backgroundColor": {"red": 0.18, "green": 0.56, "blue": 0.84},
        "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
        "horizontalAlignment": "CENTER",
    })
    # Sor színezés
    ws.format("A2:K100", {
        "backgroundColor": {"red": 0.95, "green": 0.98, "blue": 1.0},
    })
    # Befagyasztás
    ws.freeze(rows=1)
    logger.info(f"  ✅ Fogorvosok feltöltve: {len(rows) - 1} sor")


def upload_agencies(ws: gspread.Worksheet, rows: list[list]):
    """Feltölti az ügynökség adatokat + formázza."""
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    # Fejléc formázás
    ws.format("A1:I1", {
        "backgroundColor": {"red": 0.13, "green": 0.55, "blue": 0.13},
        "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
        "horizontalAlignment": "CENTER",
    })
    ws.format("A2:I20", {
        "backgroundColor": {"red": 0.93, "green": 0.99, "blue": 0.93},
    })
    ws.freeze(rows=1)
    logger.info(f"  ✅ Ügynökségek feltöltve: {len(rows) - 1} sor")


def upload_tracking(ws: gspread.Worksheet, fogorvos_count: int, agency_count: int):
    """Létrehozza a Campaign Tracking sheet-et."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    rows = [
        ["🚀 TRÓJAI FALÓ KAMPÁNY — Tracking", ""],
        ["", ""],
        ["📋 KAMPÁNY ADATOK", ""],
        ["Campaign neve", "Trójai Faló B2B Kampány"],
        ["Indulás dátuma", datetime.now().strftime("%Y-%m-%d")],
        ["Státusz", "🟢 AKTÍV"],
        ["Iparág", "Fogorvosok (Pilot)"],
        ["", ""],
        ["📊 LEAD STATISZTIKA", ""],
        ["Fogorvos leadek száma", fogorvos_count],
        ["Célzott ügynökségek", agency_count],
        ["Emailek küldve", 0],
        ["Válaszok száma", 0],
        ["Valódi érdeklődők", 0],
        ["Meeting tervezett", 0],
        ["", ""],
        ["📈 KONVERZIÓS TÖLCSÉR", ""],
        ["Küldési arány (target)", "100%  (8/8)"],
        ["Válaszarány (cél)", "30%+  (3/8)"],
        ["Érdeklődési arány (cél)", "20%+  (2/8)"],
        ["Meeting arány (cél)", "12%+  (1/8)"],
        ["", ""],
        ["📅 LOG", "Dátum / Megjegyzés"],
        ["Script futtatva", now],
        ["Google Sheets feltöltve", now],
        ["Email küldés", "⏳ Folyamatban (holnap)"],
        ["", ""],
        ["🔗 HIVATKOZÁSOK", ""],
        ["Google Sheet URL", f"https://docs.google.com/spreadsheets/d/{SHEET_ID}"],
        ["HTML Report", "conductor/tracks/trojan-horse-campaign-20260224/Brunella_Leads_Fogorvosok.html"],
        ["Email template", "conductor/tracks/trojan-horse-campaign-20260224/outreach_drafts.md"],
    ]
    ws.update("A1", rows, value_input_option="USER_ENTERED")
    ws.format("A1", {
        "textFormat": {"bold": True, "fontSize": 14},
        "backgroundColor": {"red": 1.0, "green": 0.85, "blue": 0.0},
    })
    ws.format("A3", {"textFormat": {"bold": True}})
    ws.format("A9", {"textFormat": {"bold": True}})
    ws.format("A17", {"textFormat": {"bold": True}})
    ws.format("A23", {"textFormat": {"bold": True}})
    ws.format("A28", {"textFormat": {"bold": True}})
    ws.set_column_width(0, 280)
    ws.set_column_width(1, 380)
    logger.info("  ✅ Campaign Tracking tab létrehozva")

# ============================================================================
# MAIN
# ============================================================================

def main():
    logger.info("=" * 60)
    logger.info("🚀 TROJAN-HORSE CAMPAIGN — Google Sheets Upload")
    logger.info("=" * 60)

    # 1. Fájlok ellenőrzése
    missing = []
    if not CSV_FOGORVOSOK.exists():
        missing.append(str(CSV_FOGORVOSOK))
    if not MD_AGENCIES.exists():
        missing.append(str(MD_AGENCIES))
    if missing:
        for f in missing:
            logger.error(f"❌ Fájl nem található: {f}")
        sys.exit(1)
    logger.info("✅ Input fájlok OK")

    # 2. Google Auth
    logger.info("\n📌 Lépés 1/3: Google hitelesítés...")
    client = authenticate()

    # 3. Sheet megnyitás
    logger.info("\n📌 Lépés 2/3: Google Sheet megnyitás...")
    try:
        spreadsheet = client.open_by_key(SHEET_ID)
        logger.info(f"✅ Sheet megnyitva: {spreadsheet.title}")
        logger.info(f"   URL: https://docs.google.com/spreadsheets/d/{SHEET_ID}")
    except gspread.exceptions.SpreadsheetNotFound:
        logger.error(f"❌ Sheet nem található: {SHEET_ID}")
        logger.error("   Ellenőrizd, hogy megosztottad a sheet-et a Google fiókoddal!")
        sys.exit(1)
    except gspread.exceptions.APIError as e:
        logger.error(f"❌ API hiba: {e}")
        sys.exit(1)

    # 4. Tabok létrehozása
    logger.info("\n📌 Lépés 3/3: Adatok feltöltése...")
    worksheets = setup_tabs(spreadsheet)

    # 5. Fogorvosok
    fogorvos_rows = load_fogorvosok_csv(CSV_FOGORVOSOK)
    upload_fogorvosok(worksheets["Fogorvosok"], fogorvos_rows)

    # 6. Ügynökségek
    agency_rows = load_agencies_md(MD_AGENCIES)
    upload_agencies(worksheets["Ügynökségek"], agency_rows)

    # 7. Tracking
    upload_tracking(worksheets["Campaign_Tracking"], len(fogorvos_rows) - 1, len(agency_rows) - 1)

    # 8. Összegzés
    logger.info("\n" + "=" * 60)
    logger.info("🎉 FELTÖLTÉS KÉSZ!")
    logger.info(f"   📋 Fogorvosok: {len(fogorvos_rows) - 1} sor")
    logger.info(f"   🏢 Ügynökségek: {len(agency_rows) - 1} sor")
    logger.info(f"   📊 Campaign Tracking: OK")
    logger.info(f"\n   🔗 Google Sheet URL:")
    logger.info(f"   https://docs.google.com/spreadsheets/d/{SHEET_ID}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
