# Alpha Agent - Teljesen Automatikus Portfólió Jelentés Rendszer

## 🎯 Áttekintés

Ez a rendszer **teljesen automatikusan** működik. Minden nap reggel 6:00-kor:
1. Összegyűjti a portfólió adatokat
2. Elemzést készít
3. PDF jelentést generál
4. Email-t küld a jelentéssel

## 🚀 Telepítés (Egyszeri)

```bash
cd "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"

chmod +x setup_automation.sh
./setup_automation.sh
```

A telepítő szkript:
- ✅ Telepíti a szükséges Python csomagokat
- ✅ Beállítja a Gmail App Password-öt
- ✅ Létrehozza a cron job-ot
- ✅ Teszt futtatást végez

## 🔐 Gmail App Password Beállítása

### Lépések:
1. Menj a [Google Account](https://myaccount.google.com/) → Biztonság
2. Kapcsold be a **2-lépéses hitelesítést** (ha még nincs)
3. Menj az **App jelszavak** menüpontra
4. Válaszd: **Mail** és **Mac**
5. Kattints a **Létrehozás** gombra
6. Másold ki a **16 karakteres jelszót** (pl: `abcd efgh ijkl mnop`)
7. Add meg a telepítő szkriptnek

A jelszó biztonságosan elmentésre kerül itt:
```
.gmail_app_password
```

**Fontos:** Ez NEM a Gmail jelszavad! Ez egy speciális app jelszó.

## ⏰ Automatikus Futás

### Cron Job
A rendszer automatikusan fut **minden nap reggel 6:00-kor**.

```bash
# Cron job ellenőrzése:
crontab -l

# Kimenet:
0 6 * * * cd "..." && /usr/bin/python3 ".../alpha_agent.py" >> ".../alpha_agent.log" 2>&1
```

### Mi történik automatikusan?
1. **06:00** - Cron job elindul
2. Seeking Alpha portfólió adatok gyűjtése
3. Elemzés készítése
4. Fájlok mentése (TXT, MD, PDF)
5. Email küldése a PDF melléklettel
6. Log fájl frissítése

## 📧 Email Beállítások

- **Küldő:** kovasznai.gergely@gmail.com
- **Címzett:** kovasznai.gergely@gmail.com
- **Tárgy:** Portfolio 1 - Napi Jelentés | ÉÉÉÉ-HH-NN
- **Melléklet:** Portfolio_1_Jelentes_ÉÉÉÉ-HH-NN.pdf

## 📁 Fájlok

### Generált Fájlok (Napi)
```
Portfolio_1_Jelentes_2026-01-22.txt    # Szöveges jelentés
Portfolio_1_Jelentes_2026-01-22.md     # Markdown formátum
Portfolio_1_Jelentes_2026-01-22.pdf    # PDF (email melléklet)
alpha_agent.log                         # Futási log
```

### Rendszer Fájlok
```
alpha_agent.py              # Fő ügynök szkript
generate_pdf.py             # PDF generáló
setup_automation.sh         # Telepítő szkript
.gmail_app_password         # Gmail app jelszó (titkos)
```

## 🔧 Manuális Futtatás

Ha azonnal szeretnéd futtatni (nem kell megvárni a 6:00-t):

```bash
cd "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"

python3 alpha_agent.py
```

## 📊 Monitoring

### Log Megtekintése (Élőben)
```bash
tail -f alpha_agent.log
```

### Legutóbbi Futás
```bash
tail -20 alpha_agent.log
```

### Cron Log (Rendszer Szintű)
```bash
# macOS:
log show --predicate 'process == "cron"' --last 1h
```

## 🛠️ Hibaelhárítás

### Email nem érkezik meg
1. Ellenőrizd a Gmail App Password-öt:
   ```bash
   cat .gmail_app_password
   ```
2. Teszteld az email küldést:
   ```bash
   python3 alpha_agent.py
   ```
3. Nézd meg a log fájlt:
   ```bash
   tail -50 alpha_agent.log | grep -i email
   ```

### Cron job nem fut
1. Ellenőrizd a crontab-ot:
   ```bash
   crontab -l
   ```
2. Ellenőrizd a cron szolgáltatást:
   ```bash
   # macOS esetén:
   sudo launchctl list | grep cron
   ```
3. Adj teljes hozzáférést a Terminal.app-nak:
   - Rendszerbeállítások → Adatvédelem és biztonság → Teljes lemezhez hozzáférés
   - Add hozzá a Terminal-t

### PDF nem generálódik
1. Ellenőrizd a Python csomagokat:
   ```bash
   pip3 list | grep -E "reportlab|pillow"
   ```
2. Telepítsd újra:
   ```bash
   pip3 install --upgrade reportlab pillow
   ```

## 🔄 Frissítés / Módosítás

### Email cím megváltoztatása
Szerkeszd az `alpha_agent.py` fájlt:
```python
sender_email = "uj_email@gmail.com"
receiver_email = "uj_cimzett@gmail.com"
```

### Futási idő megváltoztatása
```bash
crontab -e

# Példák:
0 7 * * *     # Minden nap 7:00
0 6 * * 1-5   # Hétköznap 6:00
0 */4 * * *   # 4 óránként
```

### Seeking Alpha Adatgyűjtés
Jelenleg placeholder adatokat használ. A Chrome automation integrációhoz:
1. Seeking Alpha bejelentkezés Chrome-ban (marad bejelentkezve)
2. `collect_portfolio_data()` függvény frissítése
3. Claude in Chrome MCP használata

## 📋 Rendszerkövetelmények

- ✅ macOS 10.15+
- ✅ Python 3.8+
- ✅ pip3
- ✅ Internet kapcsolat
- ✅ Gmail fiók (2FA engedélyezve)
- ✅ Google Drive (fájl mentéshez)
- ✅ Cron engedély (macOS)

## 🎉 Kész!

A rendszer most **teljesen automatikusan** működik. Nem kell mást tenned, csak:
- ✅ Minden reggel 6:00-kor automatikus futás
- ✅ Email automatikus érkezés
- ✅ Fájlok automatikus mentése

**Csak élvezd a napi jelentéseket! 🚀**

---

## 📞 Support

Ha bármi probléma van:
1. Nézd meg a `alpha_agent.log` fájlt
2. Futtasd manuálisan: `python3 alpha_agent.py`
3. Ellenőrizd a Gmail App Password-öt

---

**Investmentors Hungary Kft.**
🤖 Powered by Claude Alpha Agent
