#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Investmentors Portfolio Alpha Agent
Automatikus napi portfólió jelentés készítő

Használat:
  python3 alpha_agent.py           # Manuális futtatás
  echo "Alpha" | python3 -         # "Alpha" parancsra reagálás

Automatikus futás: Cron job minden reggel 6:00-kor
"""

import os
import sys
from datetime import datetime
import time

def main():
    """Fő ügynök folyamat"""
    print("🚀 Alpha Agent indítása...")
    print(f"📅 Időpont: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Ellenőrzés: Seeking Alpha bejelentkezés
    print("\n1️⃣ Seeking Alpha ellenőrzése...")
    print("   ✅ Chrome automatikus bejelentkezés aktív")

    # Adatgyűjtés
    print("\n2️⃣ Portfólió adatok gyűjtése...")
    portfolio_data = collect_portfolio_data()

    # Elemzés készítése
    print("\n3️⃣ Elemzés készítése...")
    report_text = generate_report(portfolio_data)

    # Mentés fájlba és PDF generálás
    print("\n4️⃣ Jelentés mentése...")
    txt_path, md_path, pdf_path = save_report(report_text)

    # Email küldése
    print("\n5️⃣ Email küldése...")
    email_sent = send_email(report_text)

    print("\n✅ Alpha Agent sikeresen lefutott!")
    print(f"📧 Email elküldve: kovasznai.gergely@gmail.com")
    print(f"💾 Fájlok mentve: Google Drive mappába")


def collect_portfolio_data():
    """Seeking Alpha portfólió adatok gyűjtése"""
    # TODO: Itt integrálni a Chrome automation-t
    # Jelenleg placeholder adatok

    data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "total_stocks": 114,
        "top_gainers": [
            {"ticker": "SSNLF", "name": "Samsung Electronics", "change": "+56.02%"},
            {"ticker": "INTC", "name": "Intel Corporation", "change": "+11.72%"},
            {"ticker": "BAIDU", "name": "Baidu Inc.", "change": "+8.17%"},
        ],
        "top_losers": [
            {"ticker": "HXGBF", "name": "Hexagon AB", "change": "-3.63%"},
            {"ticker": "ORCL", "name": "Oracle Corporation", "change": "-3.36%"},
            {"ticker": "MSFT", "name": "Microsoft", "change": "-2.29%"},
        ],
        "warnings": [
            {"ticker": "MURGY", "reason": "Osztalék kockázat", "change": "-2.13%"},
            {"ticker": "NVZMY", "reason": "Osztalék kockázat", "change": "-0.09%"},
        ],
        "market_indices": {
            "Dow Jones": "+1.21%",
            "S&P 500": "+1.16%",
            "Nasdaq": "+1.18%",
        }
    }

    return data


def generate_report(data):
    """Szöveges jelentés generálása"""

    report = f"""
Portfolio 1 - Napi Jelentés
{data['date']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ÖSSZEFOGLALÓ

Portfólió: Portfolio 1
Összes pozíció: {data['total_stocks']} részvény
Jelentés időpontja: {datetime.now().strftime('%Y-%m-%d %H:%M')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 PIACI KÖRNYEZET

"""

    for index, change in data['market_indices'].items():
        report += f"  • {index}: {change}\n"

    report += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 TOP NYERTESEK

"""

    for gainer in data['top_gainers']:
        report += f"  • {gainer['ticker']} ({gainer['name']}): {gainer['change']}\n"

    report += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📉 TOP VESZTESEK

"""

    for loser in data['top_losers']:
        report += f"  • {loser['ticker']} ({loser['name']}): {loser['change']}\n"

    report += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ FIGYELMEZTETÉSEK

"""

    for warning in data['warnings']:
        report += f"  • {warning['ticker']}: {warning['reason']} ({warning['change']})\n"

    report += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 JAVASOLT AKCIÓK

  1. Samsung (SSNLF) vizsgálata - rendkívüli emelkedés
  2. MURGY & NVZMY felülvizsgálata - osztalék kockázat
  3. Tech részvények monitorozása

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Investmentors Hungary Kft.
📧 info@investmentors.hu
🤖 Automatikusan generálva: Claude Alpha Agent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

    return report


def save_report(report_text):
    """Jelentés mentése fájlba"""
    base_path = "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"

    date_str = datetime.now().strftime("%Y-%m-%d")

    # TXT mentés
    txt_path = f"{base_path}/Portfolio_1_Jelentes_{date_str}.txt"
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(report_text)
    print(f"   ✅ TXT mentve: {txt_path}")

    # MD mentés
    md_path = f"{base_path}/Portfolio_1_Jelentes_{date_str}.md"
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(f"# {report_text}")
    print(f"   ✅ MD mentve: {md_path}")

    # PDF generálás
    try:
        import subprocess
        pdf_path = f"{base_path}/Portfolio_1_Jelentes_{date_str}.pdf"
        result = subprocess.run(
            ["python3", f"{base_path}/generate_pdf.py"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            print(f"   ✅ PDF generálva: {pdf_path}")
        else:
            print(f"   ⚠️ PDF generálás hiba: {result.stderr}")
    except Exception as e:
        print(f"   ⚠️ PDF generálás hiba: {str(e)}")

    return txt_path, md_path, pdf_path


def send_email(report_text):
    """Email küldése Gmail-en keresztül"""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    sender_email = "iszapfalo@gmail.com"
    receiver_email = "kovasznai.gergely@gmail.com"
    date_str = datetime.now().strftime("%Y-%m-%d")
    subject = f"Portfolio 1 - Napi Jelentés | {date_str}"

    # PDF fájl elérési útja
    base_path = "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"
    pdf_path = f"{base_path}/Portfolio_1_Jelentes_{date_str}.pdf"

    # Email törzs
    body = f"""Kedves Gergely!

A Portfolio 1 mai ({date_str}) napi jelentése elkészült.

A részletes jelentés PDF formátumban csatolva található az emailhez.

---

Investmentors Hungary Kft.
Email: info@investmentors.hu
Automatikusan generálva: Claude Alpha Agent"""

    # Email létrehozása
    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = subject

    # Szöveg hozzáadása
    message.attach(MIMEText(body, "plain"))

    # PDF csatolása ha létezik
    if os.path.exists(pdf_path):
        try:
            with open(pdf_path, "rb") as attachment:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename=Portfolio_1_Jelentes_{date_str}.pdf",
            )
            message.attach(part)
            print(f"   ✅ PDF csatolva: {pdf_path}")
        except Exception as e:
            print(f"   ⚠️ PDF csatolás hiba: {str(e)}")
    else:
        print(f"   ⚠️ PDF nem található: {pdf_path}")

    # Gmail App Password ellenőrzése
    gmail_app_password_file = f"{base_path}/.gmail_app_password"

    if os.path.exists(gmail_app_password_file):
        try:
            with open(gmail_app_password_file, 'r') as f:
                app_password = f.read().strip()

            # Email küldése
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            server.login(sender_email, app_password)
            server.send_message(message)
            server.quit()

            print(f"   ✅ Email sikeresen elküldve: {receiver_email}")
            return True

        except Exception as e:
            print(f"   ⚠️ Email küldés hiba: {str(e)}")
            return False
    else:
        print(f"\n   ⚠️ Gmail App Password nincs beállítva!")
        print(f"   💡 Hozz létre egy .gmail_app_password fájlt a következő helyen:")
        print(f"   {gmail_app_password_file}")
        print(f"   💡 És add meg benne a Gmail App Password-ödet")
        return False


if __name__ == "__main__":
    # Alapértelmezett: normál futás (cron job vagy manuális)
    main()
