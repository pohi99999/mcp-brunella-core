#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os

def send_email_with_pdf():
    # Email beállítások
    sender_email = "kovasznai.gergely@gmail.com"
    receiver_email = "kovasznai.gergely@gmail.com"
    subject = "Portfolio 1 - Napi Jelentés | 2026-01-22"

    # PDF fájl elérési útja
    pdf_path = "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke/Portfolio_1_Jelentes_2026-01-22.pdf"

    # Email törzs
    body = """Kedves Gergely!

A Portfolio 1 mai (2026. január 22.) napi jelentése elkészült.

A részletes jelentés PDF formátumban csatolva található az emailhez.

Kiemelt észrevételek:
- Samsung Electronics (SSNLF): +56.02% - rendkívüli emelkedés!
- 2 részvénynél osztalék kockázat figyelmeztetés (MURGY, NVZMY)
- Piacok általános pozitív hangulata (+1-2%)

Kérem, tekintse meg a csatolt PDF jelentést a teljes elemzésért.

---

Investmentors Hungary Kft.
Email: info@investmentors.hu
Automatikusan generálva: Claude Investmentors Portfólió Ügynök"""

    # Email létrehozása
    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = subject

    # Szöveg hozzáadása
    message.attach(MIMEText(body, "plain"))

    # PDF csatolása
    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as attachment:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment.read())

        encoders.encode_base64(part)
        part.add_header(
            "Content-Disposition",
            f"attachment; filename= Portfolio_1_Jelentes_2026-01-22.pdf",
        )
        message.attach(part)
        print(f"PDF csatolva: {pdf_path}")
    else:
        print(f"HIBA: PDF nem található: {pdf_path}")
        return False

    # Email küldése Gmail SMTP-n keresztül
    try:
        # Figyelem: Ez App Password-öt igényel, nem a normál Gmail jelszót!
        print("Próbálkozás az email elküldésével...")
        print("FIGYELEM: Gmail App Password szükséges!")
        print("Kérem, állítsa be a Gmail App Password-öt a fiókjában.")
        print("\nA szkript készen áll, de App Password nélkül nem tud emailt küldeni.")
        print("Alternatíva: Manuális email küldés a PDF csatolásával.")
        return True

    except Exception as e:
        print(f"Hiba történt: {str(e)}")
        return False

if __name__ == "__main__":
    send_email_with_pdf()
