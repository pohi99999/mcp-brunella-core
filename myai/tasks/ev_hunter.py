"""
Green Lightning - EV Hunter
Browser-Use alapú elektromos autó kereső (willhaben.at + autoscout24)

LLM: Ollama (llama3.1:8b) - ingyenes, lokális
Átváltható Gemini-re ENV változóval: EV_HUNTER_LLM=gemini

Usage:
    python ev_hunter.py              # Éles futtatás
    python ev_hunter.py --mock       # Mock mód (nincs böngésző)
    python ev_hunter.py --dry-run    # Scrape, de nem küld emailt
"""

import os
import json
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("ev_hunter")

# --- Config ---
CONFIG_PATH = Path(__file__).parent.parent / "agents" / "ev_hunter" / "config.json"
if not CONFIG_PATH.exists():
    CONFIG_PATH = Path(__file__).parent.parent.parent / "external_research" / "ev_hunter_bot" / "config.json"

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "ev_hunter_prompt.md"


@dataclass
class EVConfig:
    """EV Hunter konfiguráció"""
    min_price: int = 10000
    max_price: int = 19000
    countries: list[str] = field(default_factory=lambda: ["at", "si"])
    models: list[dict] = field(default_factory=list)
    min_score: int = 60
    max_pages: int = 3
    sender_email: str = ""
    recipient_emails: list[str] = field(default_factory=list)
    llm_provider: str = "ollama"  # "ollama" vagy "gemini"
    ollama_model: str = "llama3.1:8b"
    ollama_url: str = "http://localhost:11434"

    @classmethod
    def from_file(cls, path: Path) -> "EVConfig":
        if not path.exists():
            log.warning("Config not found at %s, using defaults", path)
            return cls()
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls(
            min_price=data.get("min_price", 10000),
            max_price=data.get("max_price", 19000),
            countries=data.get("countries", ["at", "si"]),
            models=data.get("models", []),
            min_score=data.get("min_score", 60),
            sender_email=data.get("sender_email", ""),
            recipient_emails=data.get("recipient_emails", []),
            llm_provider=os.getenv("EV_HUNTER_LLM", "ollama"),
            ollama_model=os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
            ollama_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        )


class EVListing(BaseModel):
    """Egyetlen EV hirdetés"""
    title: str
    price: Optional[int] = None
    km: Optional[int] = None
    year: Optional[int] = None
    location: Optional[str] = None
    link: Optional[str] = None
    source: str = "unknown"  # "willhaben" | "autoscout24"
    score: float = 0.0


def calculate_score(price: Optional[int], km: Optional[int], year: Optional[int]) -> float:
    """Sweet Spot algoritmus - értékeli az autót (0-100)"""
    if not all([price, km, year]):
        return 0.0

    current_year = datetime.now().year
    age = max(1, current_year - year)

    base = 100.0
    price_penalty = (price - 10000) / 400
    km_penalty = km / 4000
    age_penalty = age * 2

    return round(max(0.0, min(100.0, base - price_penalty - km_penalty - age_penalty)), 1)


def get_llm(config: EVConfig):
    """LLM inicializálás - Ollama (ingyenes) vagy Gemini (cloud)"""
    provider = config.llm_provider.lower()

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY env variable required for Gemini provider")
        log.info("LLM: Gemini 2.0 Flash")
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=api_key,
            temperature=0.1,
        )
    else:
        from langchain_ollama import ChatOllama
        log.info("LLM: Ollama %s (ingyenes)", config.ollama_model)
        return ChatOllama(
            model=config.ollama_model,
            base_url=config.ollama_url,
            temperature=0.1,
        )


# --- URL Builders ---

def willhaben_url(config: EVConfig) -> str:
    """Willhaben.at keresési URL generálás - CSAK elektromos, CSAK magánszemély"""
    base = "https://www.willhaben.at/iad/gebrauchtwagen/gebrauchtwagen-angebote"
    params = (
        f"?PRICE_FROM={config.min_price}"
        f"&PRICE_TO={config.max_price}"
        f"&FUEL_TYPE=5"        # 5 = Elektromos (BEV only)
        f"&VENDOR_TYPE=1"      # 1 = Magánszemély (privát)
        f"&rows=25"
    )
    return base + params


def autoscout_url(country: str, make: str, model: str, config: EVConfig) -> str:
    """AutoScout24 keresési URL generálás - CSAK elektromos, CSAK magánszemély"""
    base = f"https://www.autoscout24.{country}/lst"
    make_slug = make.lower().replace(" ", "-")
    model_slug = model.lower().replace(" ", "-").replace(".", "")
    return (
        f"{base}/{make_slug}/{model_slug}"
        f"?atype=C"              # C = Használt
        f"&custtype=P"           # P = Magánszemély (privát)
        f"&fuel=E"               # E = Elektromos (BEV only)
        f"&pricefrom={config.min_price}&priceto={config.max_price}"
        f"&sort=standard&desc=0"
    )


# --- Browser-Use Scrapers ---

async def scrape_willhaben(config: EVConfig, mock: bool = False) -> list[EVListing]:
    """Willhaben.at scraping Browser-Use-zal"""
    if mock:
        return _mock_listings("willhaben")

    from browser_use import Agent

    llm = get_llm(config)
    url = willhaben_url(config)
    prompt = _load_prompt("Willhaben.at Keresés", url, config.max_pages)

    log.info("Willhaben scraping indul: %s", url)

    agent = Agent(task=prompt, llm=llm)
    result = await agent.run()

    return _parse_agent_result(result, "willhaben")


async def scrape_autoscout(config: EVConfig, mock: bool = False) -> list[EVListing]:
    """AutoScout24 scraping Browser-Use-zal"""
    if mock:
        return _mock_listings("autoscout24")

    from browser_use import Agent

    llm = get_llm(config)
    all_listings: list[EVListing] = []

    for car in config.models:
        for country in config.countries:
            url = autoscout_url(country, car["make"], car["model"], config)
            prompt = _load_prompt("AutoScout24 Keresés", url, config.max_pages)

            log.info("AutoScout24 scraping: %s %s (%s)", car["make"], car["model"], country)

            agent = Agent(task=prompt, llm=llm)
            result = await agent.run()
            listings = _parse_agent_result(result, "autoscout24")
            all_listings.extend(listings)

    return all_listings


def _load_prompt(section: str, url: str, max_pages: int) -> str:
    """Prompt betöltés a prompt fájlból"""
    if PROMPT_PATH.exists():
        content = PROMPT_PATH.read_text(encoding="utf-8")
        # Keressük meg a megfelelő szekciót
        if section in content:
            idx = content.index(f"## {section}")
            # Keressük a következő ## szekciót (ha van)
            next_section = content.find("\n## ", idx + 1)
            prompt = content[idx:next_section] if next_section != -1 else content[idx:]
        else:
            prompt = content
    else:
        prompt = f"Navigálj ide: {url} és gyűjtsd ki az összes elektromos autó hirdetést JSON formátumban."

    # Template változók behelyettesítése
    prompt = prompt.replace("{url}", url)
    prompt = prompt.replace("{max_pages}", str(max_pages))
    return prompt


def _parse_agent_result(result: object, source: str) -> list[EVListing]:
    """Browser-Use agent eredmény feldolgozása"""
    listings: list[EVListing] = []

    try:
        # Az agent result-ból kinyerjük a szöveget
        text = str(result)

        # JSON keresés a szövegben
        json_start = text.find("[")
        json_end = text.rfind("]") + 1

        if json_start == -1 or json_end == 0:
            log.warning("Nem találtam JSON-t az agent válaszában (%s)", source)
            return listings

        raw = json.loads(text[json_start:json_end])

        for item in raw:
            listing = EVListing(
                title=item.get("title", "Unknown"),
                price=_safe_int(item.get("price")),
                km=_safe_int(item.get("km")),
                year=_safe_int(item.get("year")),
                location=item.get("location"),
                link=item.get("link"),
                source=source,
            )
            listing.score = calculate_score(listing.price, listing.km, listing.year)
            listings.append(listing)

    except (json.JSONDecodeError, ValueError) as e:
        log.error("JSON parse hiba (%s): %s", source, e)

    return listings


def _safe_int(value: object) -> Optional[int]:
    """Biztonságos int konverzió"""
    if value is None:
        return None
    try:
        return int(str(value).replace(",", "").replace(".", "").replace(" ", "").replace("€", "").replace("km", ""))
    except (ValueError, TypeError):
        return None


def _deduplicate(listings: list[EVListing]) -> list[EVListing]:
    """Duplikátumok eltávolítása (azonos autó eltérő forrásból)"""
    seen: set[str] = set()
    unique: list[EVListing] = []
    for listing in listings:
        key = f"{listing.title}|{listing.price}|{listing.km}|{listing.year}"
        if key not in seen:
            seen.add(key)
            unique.append(listing)
        else:
            log.debug("Duplikátum kiszűrve: %s (%s)", listing.title, listing.source)
    if len(listings) != len(unique):
        log.info("Duplikátum szűrés: %d → %d egyedi", len(listings), len(unique))
    return unique


# --- Email ---

def build_email_html(listings: list[EVListing], config: EVConfig) -> str:
    """HTML email generálás a top találatokkal"""
    top = sorted(listings, key=lambda x: x.score, reverse=True)
    qualified = [item for item in top if item.score >= config.min_score]

    if not qualified:
        return "<p>Nem találtam megfelelő ajánlatot a kritériumok felett.</p>"

    top3 = qualified[:3]

    rows = ""
    for listing in top3:
        rows += f"""
        <tr style="background-color: #e8f5e9; font-weight: bold;">
            <td>{listing.title}</td>
            <td>{listing.price or '?'} €</td>
            <td>{listing.km or '?'} km</td>
            <td>{listing.year or '?'}</td>
            <td>{listing.location or '?'}</td>
            <td style="color: #2e7d32;">{listing.score}</td>
            <td><a href="{listing.link or '#'}">Megtekintés</a></td>
            <td>{listing.source}</td>
        </tr>"""

    rest_rows = ""
    for listing in qualified[3:10]:
        rest_rows += f"""
        <tr>
            <td>{listing.title}</td>
            <td>{listing.price or '?'} €</td>
            <td>{listing.km or '?'} km</td>
            <td>{listing.year or '?'}</td>
            <td>{listing.location or '?'}</td>
            <td>{listing.score}</td>
            <td><a href="{listing.link or '#'}">Megtekintés</a></td>
            <td>{listing.source}</td>
        </tr>"""

    return f"""
    <html>
    <body>
        <h2>⚡ Green Lightning - EV Vadászat ({datetime.now().strftime('%Y-%m-%d %H:%M')})</h2>
        <p>Sweet Spot algoritmus | Budget: {config.min_price}-{config.max_price} € | Score >= {config.min_score}</p>
        <h3>🏆 TOP 3</h3>
        <table style="border-collapse:collapse;width:100%;">
            <tr style="background:#f2f2f2;">
                <th style="border:1px solid #ddd;padding:8px;">Modell</th>
                <th style="border:1px solid #ddd;padding:8px;">Ár</th>
                <th style="border:1px solid #ddd;padding:8px;">Km</th>
                <th style="border:1px solid #ddd;padding:8px;">Év</th>
                <th style="border:1px solid #ddd;padding:8px;">Hely</th>
                <th style="border:1px solid #ddd;padding:8px;">Score</th>
                <th style="border:1px solid #ddd;padding:8px;">Link</th>
                <th style="border:1px solid #ddd;padding:8px;">Forrás</th>
            </tr>
            {rows}
            {rest_rows}
        </table>
        <br>
        <p><small>Brunella Green Lightning v1.0 | Ollama + Browser-Use</small></p>
    </body>
    </html>
    """


def send_email_notification(listings: list[EVListing], config: EVConfig, dry_run: bool = False) -> bool:
    """Email küldés Gmail SMTP-vel"""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    qualified = [item for item in listings if item.score >= config.min_score]
    if not qualified:
        log.info("Nincs jó találat (score >= %d), email kihagyva", config.min_score)
        return False

    html = build_email_html(listings, config)

    # Mindig mentjük lokálisan
    output_path = Path(__file__).parent.parent.parent / "latest_email.html"
    output_path.write_text(html, encoding="utf-8")
    log.info("HTML mentve: %s", output_path)

    if dry_run:
        log.info("DRY RUN - email nem küldve")
        return True

    smtp_password = os.getenv("SMTP_PASSWORD")
    if not smtp_password:
        log.warning("SMTP_PASSWORD nem beállítva, email kihagyva")
        return False

    try:
        msg = MIMEMultipart()
        best = sorted(qualified, key=lambda x: x.score, reverse=True)[0]
        msg["Subject"] = f"⚡ EV Hunter: {best.title} ({best.score} pont) - {len(qualified)} találat"
        msg["From"] = config.sender_email
        msg["To"] = ", ".join(config.recipient_emails)
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(config.sender_email, smtp_password)
            server.send_message(msg)

        log.info("Email elküldve: %s (%d találat)", ", ".join(config.recipient_emails), len(qualified))
        return True

    except Exception as e:
        log.error("Email küldés hiba: %s", e)
        return False


# --- Mock Data ---

def _mock_listings(source: str) -> list[EVListing]:
    """Teszt adatok Browser-Use nélkül"""
    mock_data = [
        {"title": "BMW i3 120 Ah", "price": 16500, "km": 38000, "year": 2021, "location": "Wien"},
        {"title": "Nissan Leaf 40 kWh", "price": 12500, "km": 65000, "year": 2019, "location": "Graz"},
        {"title": "VW ID.3 Pro", "price": 18900, "km": 25000, "year": 2022, "location": "Salzburg"},
        {"title": "Kia e-Niro 64 kWh", "price": 17500, "km": 42000, "year": 2022, "location": "Ljubljana"},
        {"title": "Hyundai Kona Electric", "price": 15800, "km": 31000, "year": 2021, "location": "Linz"},
    ]
    listings = []
    for item in mock_data:
        listing = EVListing(
            title=item["title"],
            price=item["price"],
            km=item["km"],
            year=item["year"],
            location=item["location"],
            link=f"https://www.{source}.at/mock/{item['title'].replace(' ', '-').lower()}",
            source=source,
        )
        listing.score = calculate_score(listing.price, listing.km, listing.year)
        listings.append(listing)
    return listings


# --- Main ---

async def run_ev_hunter(mock: bool = False, dry_run: bool = False) -> list[EVListing]:
    """Fő futtatási logika"""
    config = EVConfig.from_file(CONFIG_PATH)
    log.info("=== Green Lightning EV Hunter ===")
    log.info("LLM: %s | Budget: %d-%d € | Score limit: %d",
             config.llm_provider, config.min_price, config.max_price, config.min_score)

    # Parallel scraping
    willhaben_task = scrape_willhaben(config, mock=mock)
    autoscout_task = scrape_autoscout(config, mock=mock)

    willhaben_results, autoscout_results = await asyncio.gather(
        willhaben_task, autoscout_task
    )

    all_listings = _deduplicate(willhaben_results + autoscout_results)
    all_listings.sort(key=lambda x: x.score, reverse=True)

    log.info("Összes találat: %d (willhaben: %d, autoscout: %d)",
             len(all_listings), len(willhaben_results), len(autoscout_results))

    qualified = [item for item in all_listings if item.score >= config.min_score]
    log.info("Kvalifikált (score >= %d): %d", config.min_score, len(qualified))

    if qualified:
        log.info("TOP 3:")
        for listing in qualified[:3]:
            log.info("  %.1f pont | %s | %s€ | %skm | %s | %s",
                     listing.score, listing.title, listing.price, listing.km, listing.year, listing.source)

    # Email
    send_email_notification(all_listings, config, dry_run=dry_run)

    # JSON export
    output_json = Path(__file__).parent.parent.parent / "data" / "ev_hunter_results.json"
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(
        json.dumps([item.model_dump() for item in all_listings], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log.info("Eredmények mentve: %s", output_json)

    return all_listings


if __name__ == "__main__":
    import sys

    mock = "--mock" in sys.argv
    dry_run = "--dry-run" in sys.argv

    if mock:
        log.info("MOCK mód - nincs böngésző")
    if dry_run:
        log.info("DRY RUN - nincs email")

    results = asyncio.run(run_ev_hunter(mock=mock, dry_run=dry_run))
    log.info("Kész! %d találat feldolgozva.", len(results))
