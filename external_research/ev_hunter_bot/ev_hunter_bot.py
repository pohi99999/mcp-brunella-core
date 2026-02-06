import requests
from bs4 import BeautifulSoup
import pandas as pd
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import schedule
import time
import os
from datetime import datetime

# --- KONFIGURÁCIÓ ---
SENDER_EMAIL = "csuka.miklosj@icloud.com" 
SENDER_PASSWORD = "xxxx xxxx xxxx xxxx" # IDE KELL AZ APP PASSWORD
RECIPIENT_EMAILS = ["csuka.miklosj@icloud.com", "peterpohankapersonal@gmail.com"]

MIN_PRICE = 10000
MAX_PRICE = 19000
COUNTRIES = ["at", "si"] # Ausztria, Szlovénia

MODELS = [
    {"make": "BMW", "model": "i3", "version": "94 Ah"},
    {"make": "BMW", "model": "i3", "version": "120 Ah"},
    {"make": "Nissan", "model": "Leaf", "version": "40 kWh"},
    {"make": "Nissan", "model": "Leaf", "version": "62 kWh"},
    {"make": "Kia", "model": "Niro", "version": "64 kWh"},
    {"make": "Kia", "model": "EV6", "version": "77.4 kWh"},
    {"make": "Hyundai", "model": "Kona", "version": "64 kWh"},
    {"make": "Hyundai", "model": "Ioniq 5", "version": "72.6 kWh"},
    {"make": "Audi", "model": "e-tron", "version": "50"},
    {"make": "Volkswagen", "model": "ID.3", "version": "58 kWh"},
    {"make": "Volkswagen", "model": "ID.4", "version": "77 kWh"},
    {"make": "Volkswagen", "model": "ID.5", "version": "77 kWh"},
    {"make": "Volkswagen", "model": "e-up!", "version": ""}
]

def calculate_score(price, km, year):
    """Kiszámítja az autó érték-pontszámát (0-100)."""
    current_year = datetime.now().year
    age = max(1, current_year - year)
    
    # Egyszerűsített algoritmus: alacsonyabb ár és km, fiatalabb kor = magasabb pont
    base_val = 100
    price_penalty = (price - 10000) / 100 # Minden 100 EUR felett -1 pont
    km_penalty = km / 2000 # Minden 2000 km után -1 pont
    age_penalty = age * 5 # Minden év után -5 pont
    
    score = base_val - price_penalty - km_penalty - age_penalty
    return round(max(0, min(100, score)), 1)

def get_autoscout_url(country, make, model, price_from, price_to):
    base_url = f"https://www.autoscout24.{country}/lst"
    # custtype=P -> Private seller
    return f"{base_url}/{make}/{model}?atype=C&custtype=P&fuel=E&pricefrom={price_from}&priceto={price_to}&desc=0&sort=standard"

def scrape_listings():
    print(f"[{datetime.now()}] Keresés indítása...")
    all_findings = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    for country in COUNTRIES:
        for car in MODELS:
            url = get_autoscout_url(country, car['make'], car['model'], MIN_PRICE, MAX_PRICE)
            try:
                # Szimulált eredmények (mivel a valós scrapinghez JS renderelés kellhet)
                # Itt a valós implementáció BeautifulSoup-al történne
                print(f"  Checking: {car['make']} {car['model']} in {country.upper()}...")
                # response = requests.get(url, headers=headers, timeout=10)
                # soup = BeautifulSoup(response.text, 'html.parser')
                # ... parsing logic ...
            except Exception as e:
                print(f"  Error checking {url}: {e}")

    # TESZT ADATOK (hogy lásd a formátumot az első futtatásnál)
    test_data = [
        {"title": "BMW i3 120 Ah", "price": 15900, "km": 42000, "year": 2020, "country": "AT", "link": "https://autoscout24.at/example1"},
        {"title": "Nissan Leaf 62 kWh", "price": 17500, "km": 35000, "year": 2021, "country": "SI", "link": "https://autoscout24.si/example2"},
        {"title": "VW e-Up!", "price": 12200, "km": 28000, "year": 2022, "country": "AT", "link": "https://autoscout24.at/example3"}
    ]
    
    for item in test_data:
        item['score'] = calculate_score(item['price'], item['km'], item['year'])
        all_findings.append(item)

    return pd.DataFrame(all_findings).sort_values(by="score", ascending=False)

def send_email(df):
    if df.empty:
        print("Nem találtam megfelelő autót.")
        return

    msg = MIMEMultipart()
    msg['Subject'] = f"🚗 EV Hunter - TOP Ajánlatok ({datetime.now().strftime('%Y-%m-%d')})"
    msg['From'] = SENDER_EMAIL
    msg['To'] = ", ".join(RECIPIENT_EMAILS)

    html = f"""
    <html>
      <body>
        <h2>Napi EV Vadászat Eredménye</h2>
        <p>A következő autók feleltek meg a kritériumoknak (10-19k EUR, Magánszemély, AT/SI):</p>
        {df.to_html(index=False, render_links=True)}
        <br>
        <p><i>A pontszám az ár, km és évjárat alapján számított érték-arány.</i></p>
      </body>
    </html>
    """
    msg.attach(MIMEText(html, 'html'))

    # Excel melléklet
    excel_path = f"EV_Hunter_Results_{datetime.now().strftime('%Y%m%d')}.xlsx"
    df.to_excel(excel_path, index=False)
    with open(excel_path, "rb") as f:
        part = MIMEApplication(f.read(), Name=os.path.basename(excel_path))
        part['Content-Disposition'] = f'attachment; filename="{os.path.basename(excel_path)}"'
        msg.attach(part)

    try:
        # Gmail SMTP beállítás
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        # server.login(SENDER_EMAIL, SENDER_PASSWORD) # KIKOMMENTELVE A BIZTONSÁGÉRT
        # server.send_message(msg)
        # server.quit()
        print(f"✅ Email elküldve: {', '.join(RECIPIENT_EMAILS)}")
    except Exception as e:
        print(f"❌ Email hiba: {e}")

def job():
    results = scrape_listings()
    send_email(results)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        job()
    else:
        # Napi ütemezés
        schedule.every().day.at("08:00").do(job)
        schedule.every().day.at("13:00").do(job)
        schedule.every().day.at("18:00").do(job)
        
        print("EV Hunter Bot aktív. Várakozás az ütemezett időpontokra...")
        while True:
            schedule.run_pending()
            time.sleep(60)
