"""
Gmail Iszapfaló Kommunikáció Extractor
=====================================
Python IMAP script hogy kinyerjük a "kovasznai.gergely@gmail.com" és "iszapfalo@gmail.com"
email címekkel folytatott levelezést, az n8n migráció időnyilvántartásához.

Használat:
    python scripts/gmail_iszapfalo_extract.py

Eredmény:
    -> .worktrees/004_Iszapfaló_n8n/Migracio/GMAIL_KOMMUNIKACIO.md
"""

import imaplib
import email
from email.header import decode_header
from datetime import datetime
import os
import sys
import socket
from pathlib import Path

# Globális socket timeout: 20 másodperc
socket.setdefaulttimeout(20)

# --- CONFIG ---
GMAIL_USER = os.getenv("GMAIL_USER", "peterpohankapersonal@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_PASSWORD", "")  # App Password from .env
IMAP_SERVER = "imap.gmail.com"
IMAP_PORT = 993

# Keresési feltételek
SEARCH_CONTACTS = [
    "kovasznai.gergely@gmail.com",
    "iszapfalo@gmail.com",
    "kovásznai",
    "iszapfalo",
    "iszapfaló",
]

# Dátum tartomány: 2026 február-március
DATE_SINCE = "01-Feb-2026"
DATE_BEFORE = "01-Apr-2026"

OUTPUT_DIR = Path(__file__).parent.parent / ".worktrees" / "004_Iszapfaló_n8n" / "Migracio"
OUTPUT_FILE = OUTPUT_DIR / "GMAIL_KOMMUNIKACIO.md"


def decode_mime_header(header_value):
    """Dekódol egy MIME fejlécet (Subject, From stb.)"""
    if not header_value:
        return ""
    parts = decode_header(header_value)
    decoded = []
    for part, encoding in parts:
        if isinstance(part, bytes):
            try:
                decoded.append(part.decode(encoding or "utf-8", errors="replace"))
            except (LookupError, UnicodeDecodeError):
                decoded.append(part.decode("utf-8", errors="replace"))
        else:
            decoded.append(str(part))
    return " ".join(decoded)


def get_email_body(msg):
    """Kinyeri az email szöveges tartalmát (plain text preferencia)."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disp = str(part.get("Content-Disposition", ""))
            
            # Mellékleteket átugorjuk
            if "attachment" in content_disp:
                continue
                
            if content_type == "text/plain":
                charset = part.get_content_charset() or "utf-8"
                try:
                    body = part.get_payload(decode=True).decode(charset, errors="replace")
                except Exception:
                    body = str(part.get_payload(decode=True))
                break
            elif content_type == "text/html" and not body:
                charset = part.get_content_charset() or "utf-8"
                try:
                    raw = part.get_payload(decode=True).decode(charset, errors="replace")
                    # Egyszerű HTML tag eltávolítás
                    import re
                    body = re.sub(r'<[^>]+>', '', raw)
                    body = re.sub(r'\s+', ' ', body).strip()
                except Exception:
                    pass
    else:
        charset = msg.get_content_charset() or "utf-8"
        try:
            body = msg.get_payload(decode=True).decode(charset, errors="replace")
        except Exception:
            body = str(msg.get_payload(decode=True))
    
    return body.strip()


def get_attachments_info(msg):
    """Melléklet listát ad vissza."""
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            content_disp = str(part.get("Content-Disposition", ""))
            if "attachment" in content_disp:
                filename = decode_mime_header(part.get_filename() or "ismeretlen")
                size = len(part.get_payload(decode=True) or b"")
                attachments.append(f"{filename} ({size // 1024} KB)")
    return attachments


def search_gmail_imap(mail, query, folder="INBOX"):
    """Keres emaileket IMAP-on."""
    mail.select(folder, readonly=True)
    status, data = mail.search(None, query)
    if status != "OK":
        return []
    return data[0].split()


def collect_emails():
    """Fő email gyűjtő funkció."""
    
    if not GMAIL_APP_PASSWORD:
        print("❌ GMAIL_PASSWORD nincs beállítva a .env-ben!")
        print("   Szükséges: Google App Password (2FA szükséges)")
        print("   Generálás: https://myaccount.google.com/apppasswords")
        sys.exit(1)
    
    print(f"📧 Gmail IMAP csatlakozás: {GMAIL_USER}")
    print(f"📅 Keresés: {DATE_SINCE} - {DATE_BEFORE}")
    print(f"🔍 Kontaktok: {', '.join(SEARCH_CONTACTS[:2])}")
    print()
    
    # IMAP Csatlakozás
    mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
    mail.socket().settimeout(30)  # 30s timeout
    mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)
    
    all_emails = []
    seen_ids = set()
    
    # Keresési stratégiák
    searches = [
        # 1. FROM kovasznai.gergely
        f'(FROM "kovasznai.gergely@gmail.com" SINCE "{DATE_SINCE}" BEFORE "{DATE_BEFORE}")',
        # 2. TO kovasznai.gergely
        f'(TO "kovasznai.gergely@gmail.com" SINCE "{DATE_SINCE}" BEFORE "{DATE_BEFORE}")',
        # 3. FROM iszapfalo
        f'(FROM "iszapfalo@gmail.com" SINCE "{DATE_SINCE}" BEFORE "{DATE_BEFORE}")',
        # 4. TO iszapfalo
        f'(TO "iszapfalo@gmail.com" SINCE "{DATE_SINCE}" BEFORE "{DATE_BEFORE}")',
        # 5. Subject-ben "iszapfalo" vagy "n8n"
        f'(SUBJECT "iszapfalo" SINCE "{DATE_SINCE}" BEFORE "{DATE_BEFORE}")',
        f'(SUBJECT "n8n" SINCE "{DATE_SINCE}" BEFORE "{DATE_BEFORE}")',
        # Removed: non-ASCII chars fail in IMAP SUBJECT search,
    ]
    
    # Mappák keresése
    folders_to_search = ["INBOX", "[Gmail]/Sent Mail"]  # Removed All Mail to avoid duplicates/timeouts
    
    for folder in folders_to_search:
        try:
            status, _ = mail.select(f'"{folder}"', readonly=True)
            if status != "OK":
                print(f"  ⚠️ Mappa nem elérhető: {folder}")
                continue
        except Exception as e:
            print(f"  ⚠️ Mappa hiba: {folder} - {e}")
            continue
            
        print(f"📁 Keresés mappában: {folder}")
        
        for search_query in searches:
            try:
                status, data = mail.search(None, search_query)
                if status != "OK" or not data[0]:
                    continue
                
                msg_ids = data[0].split()
                print(f"  🔍 {search_query[:60]}... → {len(msg_ids)} találat")
                
                for msg_id in msg_ids:
                    if msg_id in seen_ids:
                        continue
                    seen_ids.add(msg_id)
                    
                    try:
                        status, msg_data = mail.fetch(msg_id, "(RFC822)")
                        if status != "OK" or not msg_data or not msg_data[0]:
                            continue
                        
                        raw_email = msg_data[0][1]
                        msg = email.message_from_bytes(raw_email)
                        
                        # Fejlécek kinyerése
                        subject = decode_mime_header(msg["Subject"])
                        from_addr = decode_mime_header(msg["From"])
                        to_addr = decode_mime_header(msg.get("To", ""))
                        cc_addr = decode_mime_header(msg.get("Cc", ""))
                        date_str = msg["Date"]
                        message_id = msg.get("Message-ID", "")
                        
                        # Dátum parse
                        try:
                            date_tuple = email.utils.parsedate_to_datetime(date_str)
                        except Exception:
                            date_tuple = datetime.now()
                        
                        # Body
                        body = get_email_body(msg)
                        
                        # Mellékletek
                        attachments = get_attachments_info(msg)
                        
                        all_emails.append({
                            "date": date_tuple,
                            "date_str": date_str,
                            "from": from_addr,
                            "to": to_addr,
                            "cc": cc_addr,
                            "subject": subject,
                            "body": body[:2000],  # Max 2000 karakter
                            "attachments": attachments,
                            "message_id": message_id,
                            "folder": folder,
                        })
                    except Exception as e:
                        print(f"    ⚠️ Email feldolgozás hiba: {e}")
                        
            except Exception as e:
                print(f"  ⚠️ Keresés hiba: {e}")
    
    mail.logout()
    
    # Rendezés dátum szerint
    all_emails.sort(key=lambda x: x["date"])
    
    # Deduplikálás message_id alapján
    unique_emails = {}
    for em in all_emails:
        mid = em["message_id"] or f"{em['date']}_{em['subject']}"
        if mid not in unique_emails:
            unique_emails[mid] = em
    
    final_emails = sorted(unique_emails.values(), key=lambda x: x["date"])
    
    print(f"\n✅ Összesen {len(final_emails)} egyedi email találat")
    
    return final_emails


def generate_markdown(emails):
    """Markdown dokumentumot generál az emailekből."""
    
    lines = [
        "# 📧 Gmail Kommunikáció — Iszapfaló n8n Projekt",
        f"**Generálva:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**Gmail fiók:** {GMAIL_USER}",
        f"**Keresett kontaktok:** kovasznai.gergely@gmail.com, iszapfalo@gmail.com",
        f"**Időszak:** 2026. február – 2026. március",
        f"**Találatok:** {len(emails)} email",
        "",
        "---",
        "",
    ]
    
    if not emails:
        lines.append("⚠️ Nem található email a megadott feltételekkel ebben az időszakban.")
        lines.append("")
        lines.append("Lehetséges okok:")
        lines.append("- A kommunikáció más csatornán történt (Messenger, telefon, személyes)")
        lines.append("- Az App Password hibás vagy lejárt")
        lines.append("- A levelek más Gmail mappában vannak (Spam, Archív)")
        lines.append("")
    else:
        # Összesítő táblázat
        lines.append("## 📊 Email Összesítő")
        lines.append("")
        lines.append("| # | Dátum | Irány | Tárgy | Melléklet |")
        lines.append("|---|-------|-------|-------|-----------|")
        
        for i, em in enumerate(emails, 1):
            date_fmt = em["date"].strftime("%Y-%m-%d %H:%M")
            is_sent = GMAIL_USER.lower() in em["from"].lower()
            direction = "📤 Kimenő" if is_sent else "📥 Bejövő"
            subj = em["subject"][:50] + ("..." if len(em["subject"]) > 50 else "")
            att = f"📎 {len(em['attachments'])} db" if em["attachments"] else "—"
            lines.append(f"| {i} | {date_fmt} | {direction} | {subj} | {att} |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # Részletes emailek
        lines.append("## 📬 Részletes Email Tartalom")
        lines.append("")
        
        for i, em in enumerate(emails, 1):
            date_fmt = em["date"].strftime("%Y-%m-%d %H:%M")
            is_sent = GMAIL_USER.lower() in em["from"].lower()
            
            lines.append(f"### Email #{i} — {date_fmt}")
            lines.append("")
            lines.append(f"| Mező | Érték |")
            lines.append(f"|------|-------|")
            lines.append(f"| **Feladó** | {em['from']} |")
            lines.append(f"| **Címzett** | {em['to']} |")
            if em["cc"]:
                lines.append(f"| **CC** | {em['cc']} |")
            lines.append(f"| **Tárgy** | {em['subject']} |")
            lines.append(f"| **Dátum** | {em['date_str']} |")
            lines.append(f"| **Irány** | {'📤 KIMENŐ' if is_sent else '📥 BEJÖVŐ'} |")
            lines.append(f"| **Mappa** | {em['folder']} |")
            
            if em["attachments"]:
                lines.append(f"| **Mellékletek** | {', '.join(em['attachments'])} |")
            
            lines.append("")
            lines.append("**Tartalom:**")
            lines.append("```")
            # Rövidítés ha túl hosszú
            body = em["body"]
            if len(body) > 1500:
                body = body[:1500] + "\n\n[... rövidítve ...]"
            lines.append(body)
            lines.append("```")
            lines.append("")
            lines.append("---")
            lines.append("")
    
    # Időnyilvántartáshoz releváns szekció
    lines.extend([
        "## 🕐 Releváns információk az Időnyilvántartáshoz",
        "",
        "Az emailekből kinyerhető munka-kommunikációs adatok:",
        "",
        "| Dátum | Kommunikáció típusa | Tartalom összefoglaló |",
        "|-------|--------------------|-----------------------|",
    ])
    
    for em in emails:
        date_fmt = em["date"].strftime("%Y-%m-%d")
        is_sent = GMAIL_USER.lower() in em["from"].lower()
        comm_type = "Email küldés" if is_sent else "Email fogadás"
        summary = em["subject"][:80]
        lines.append(f"| {date_fmt} | {comm_type} | {summary} |")
    
    lines.append("")
    lines.append("---")
    lines.append(f"*Automatikusan generálta: `scripts/gmail_iszapfalo_extract.py` — {datetime.now().isoformat()}*")
    lines.append("")
    
    return "\n".join(lines)


def main():
    print("=" * 60)
    print("📧 ISZAPFALÓ GMAIL KOMMUNIKÁCIÓ EXTRACTOR")
    print("=" * 60)
    print()
    
    emails = collect_emails()
    
    md_content = generate_markdown(emails)
    
    # Mentés
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(md_content, encoding="utf-8")
    print(f"\n📄 Eredmény mentve: {OUTPUT_FILE}")
    print(f"   {len(emails)} email dokumentálva")
    
    # Extra: SENT mappából is keresés n8n/iszapfalo tárgyú levelekre
    print("\n✅ Kész! A GMAIL_KOMMUNIKACIO.md frissítve.")


if __name__ == "__main__":
    main()
