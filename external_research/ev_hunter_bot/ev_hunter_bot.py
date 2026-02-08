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
import json
from datetime import datetime

# --- CONFIG LOADING ---
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

def load_config():
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"Config file not found at {CONFIG_PATH}")
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

CONFIG = load_config()

SENDER_EMAIL = CONFIG.get("sender_email")
RECIPIENT_EMAILS = CONFIG.get("recipient_emails", [])
MIN_PRICE = CONFIG.get("min_price", 10000)
MAX_PRICE = CONFIG.get("max_price", 19000)
COUNTRIES = CONFIG.get("countries", ["at", "si"])
MODELS = CONFIG.get("models", [])
SCHEDULE_TIMES = CONFIG.get("schedule_times", ["08:00"])
MIN_SCORE = CONFIG.get("min_score", 80)

def calculate_score(price, km, year):
    """Kiszámítja az autó érték-pontszámát (0-100)."""
    current_year = datetime.now().year
    age = max(1, current_year - year)
    
    # Értékelési logika: Sweet Spot keresés (Lazított)
    # Alap: 100 pont
    base_val = 100
    
    # Ár büntetés: (Price - 10k) / 500 -> 15000 = -10p, 19000 = -18p
    price_penalty = (price - 10000) / 400
        
    # Km büntetés: Km / 4000 -> 40000 = -10p
    km_penalty = km / 4000
    
    # Kor büntetés: Évente -2p
    age_penalty = age * 2 
    
    score = base_val - price_penalty - km_penalty - age_penalty
    return round(max(0, min(100, score)), 1)

def get_autoscout_url(country, make, model, price_from, price_to):
    base_url = f"https://www.autoscout24.{country}/lst"
    return f"{base_url}/{make}/{model}?atype=C&custtype=P&fuel=E&pricefrom={price_from}&priceto={price_to}&desc=0&sort=standard"

def scrape_listings():
    print(f"[{datetime.now()}] Keresés indítása ({', '.join(COUNTRIES)})...")
    all_findings = []

    # Valós scraping helyett most mock adatokat generálunk, 
    # de a struktúra készen áll a requests/bs4 beillesztésére.
    
    # TESZT ADATOK GENERÁLÁSA
    test_data = [
        {"title": "BMW i3 120 Ah (Sweet Spot)", "price": 16500, "km": 38000, "year": 2021, "country": "AT", "link": "https://autoscout24.at/example1"},
        {"title": "Nissan Leaf 40 kWh", "price": 12500, "km": 65000, "year": 2019, "country": "SI", "link": "https://autoscout24.si/example2"}, 
        {"title": "VW e-Up! (Jó ajánlat)", "price": 11000, "km": 25000, "year": 2022, "country": "AT", "link": "https://autoscout24.at/example3"},
        {"title": "Kia e-Niro 64 kWh (Best Buy)", "price": 18900, "km": 42000, "year": 2022, "country": "SI", "link": "https://autoscout24.si/example4"}
    ]
    
    for item in test_data:
        item['score'] = calculate_score(item['price'], item['km'], item['year'])
        if item['score'] >= MIN_SCORE:
            all_findings.append(item)

    if not all_findings:
        print(f"[{datetime.now()}] Nincs találat a limit felett (Score >= {MIN_SCORE}).")
        return pd.DataFrame()

    df = pd.DataFrame(all_findings).sort_values(by="score", ascending=False)
    print(f"[{datetime.now()}] Találatok száma (Score >= {MIN_SCORE}): {len(df)}")
    return df

def send_email(df):
    if df.empty:
        print("Nem találtam megfelelő autót a kritériumok felett.")
        return

    top_3 = df.head(3)
    
    msg = MIMEMultipart()
    msg['Subject'] = f"⚡ EV Hunter TOP 3: {top_3.iloc[0]['title']} ({top_3.iloc[0]['score']} pont)"
    msg['From'] = SENDER_EMAIL
    msg['To'] = ", ".join(RECIPIENT_EMAILS)

    # HTML Table stílus
    style = """
    <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .score { font-weight: bold; color: #2e7d32; }
        .highlight { background-color: #e8f5e9; font-weight: bold; }
    </style>
    """

    html = f"""
    <html>
      <head>{style}</head>
      <body>
        <h2>⚡ Mai EV Vadászat Eredménye</h2>
        <p>A "Sweet Spot" algoritmus alapján a legjobb ajánlatok (Score >= {MIN_SCORE}):</p>
        
        <h3>🏆 TOP 3 Ajánlat</h3>
        <table>
            <tr>
                <th>Modell</th>
                <th>Ár</th>
                <th>Km</th>
                <th>Év</th>
                <th>Ország</th>
                <th>Pontszám</th>
                <th>Link</th>
            </tr>
    """
    
    for _, row in top_3.iterrows():
        html += f"""
            <tr class="highlight">
                <td>{row['title']}</td>
                <td>{row['price']} €</td>
                <td>{row['km']} km</td>
                <td>{row['year']}</td>
                <td>{row['country']}</td>
                <td class="score">{row['score']}</td>
                <td><a href="{row['link']}">Megtekintés</a></td>
            </tr>
        """
        
    html += """
        </table>
        <br>
        <h3>📋 További találatok</h3>
        """
        
    # A maradék (ha van)
    if len(df) > 3:
        html += df.iloc[3:].to_html(index=False, render_links=True, classes='table')
    else:
        html += "<p>Nincs több kiemelkedő találat mára.</p>"

    html += """
        <br>
        <p><small><i>Brunella EV Hunter v2.0 | Config: Budget 10-19k, AT/SI</i></small></p>
      </body>
    </html>
    """
    
    msg.attach(MIMEText(html, 'html'))

    # Excel melléklet
    excel_path = f"EV_Hunter_Results_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    df.to_excel(excel_path, index=False)
    with open(excel_path, "rb") as f:
        part = MIMEApplication(f.read(), Name=os.path.basename(excel_path))
        part['Content-Disposition'] = f'attachment; filename="{os.path.basename(excel_path)}"'
        msg.attach(part)

    try:
        # Gmail SMTP beállítás (ENV változóból vagy configból, ha lenne)
        # server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        # server.login(SENDER_EMAIL, os.environ.get('SMTP_PASSWORD', 'xxxx')) 
        # server.send_message(msg)
        # server.quit()
        print(f"✅ Email szimulálva: {', '.join(RECIPIENT_EMAILS)}")
        print("HTML Preview mentése: latest_email.html")
        with open("latest_email.html", "w", encoding="utf-8") as f:
            f.write(html)
            
    except Exception as e:
        print(f"❌ Email hiba: {e}")
        
    # Cleanup
    if os.path.exists(excel_path):
        os.remove(excel_path)

def job():
    results = scrape_listings()
    send_email(results)

if __name__ == "__main__":
    import sys
    
    print(f"EV Hunter v2.0 Config Loaded: {len(MODELS)} models, Score limit: {MIN_SCORE}")
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        print("Running in TEST mode...")
        job()
    else:
        # Dinamikus ütemezés config alapján
        for t in SCHEDULE_TIMES:
            schedule.every().day.at(t).do(job)
            print(f" -> Scheduled at {t}")
        
        print(f"EV Hunter Bot aktív. Várakozás...")
        while True:
            schedule.run_pending()
            time.sleep(60)
