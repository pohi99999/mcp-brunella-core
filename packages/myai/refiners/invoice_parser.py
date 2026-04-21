import re
import asyncio
from typing import Dict, Any
from data.invoice_templates.invoice_schema import InvoiceData, InvoiceItem
from datetime import datetime

async def parse_invoice_text(text: str) -> InvoiceData:
    """
    Strukturált adatok kinyerése a számla szövegéből.
    Valós környezetben itt egy LLM vagy specifikus regex pipeline futna.
    """
    # Egyszerű regex alapú kinyerés (példa)
    invoice_number = re.search(r"Számla sorszáma:?\s*(\S+)", text, re.I)
    vendor_name = re.search(r"Szállító:?\s*([^\n]+)", text, re.I)
    amount = re.search(r"Végösszeg:?\s*([\d\s]+)", text, re.I)
    date_match = re.search(r"Kelt:?\s*([\d\.\-\s]+)", text, re.I)
    due_date_match = re.search(r"Határidő:?\s*([\d\.\-\s]+)", text, re.I)

    # Tisztítás és validáció
    inv_no = invoice_number.group(1) if invoice_number else "N/A"
    vendor = vendor_name.group(1).strip() if vendor_name else "Ismeretlen"
    
    # Összeg tisztítása (szóközök eltávolítása)
    raw_amount = amount.group(1).replace(" ", "") if amount else "0"
    total_amount = float(raw_amount)

    # Dátumok parsolása
    def parse_date(d_str):
        if not d_str: return datetime.now().date()
        clean_str = d_str.strip().replace(".", "-").replace(" ", "")
        try:
            return datetime.strptime(clean_str[:10], "%Y-%m-%d").date()
        except:
            return datetime.now().date()

    inv_date = parse_date(date_match.group(1) if date_match else None)
    due_date = parse_date(due_date_match.group(1) if due_date_match else None)

    # Biztosítsunk legalább egy üres vagy alapértelmezett sort a LanceDB típusfelismeréséhez
    items = []
    if "Tárgy:" in text:
        items.append(InvoiceItem(description=text.split("Tárgy:")[1].strip(), quantity=1, unit_price=total_amount, total=total_amount))
    else:
        items.append(InvoiceItem(description="Szolgáltatás", quantity=1, unit_price=total_amount, total=total_amount))

    return InvoiceData(
        invoice_number=inv_no,
        vendor_name=vendor,
        amount=total_amount,
        currency="HUF",
        invoice_date=inv_date,
        due_date=due_date,
        line_items=items,
        confidence=90.0
    )

async def process_invoice_file(file_path: str) -> Dict[str, Any]:
    """
    PDF fájl feldolgozása (OCR -> Text -> Pydantic).
    """
    # Itt történne az OCR (pl. pytesseract vagy pdf2image)
    # Most szimuláljuk a kinyert szöveget
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    invoice_data = await parse_invoice_text(text)
    return invoice_data.model_dump()

if __name__ == "__main__":
    # Gyors teszt
    sample_text = """
    Szállító: TechSupply Kft.
    Számla sorszáma: INV-2026-001
    Kelt: 2026.02.20.
    Határidő: 2026.03.05.
    Végösszeg: 150 000 HUF
    """
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(parse_invoice_text(sample_text))
    print(result.json(indent=2))
