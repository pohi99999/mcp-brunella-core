# 🚀 KEZDD ITT - Alpha Agent Automatikus Rendszer

## ✅ A rendszer MAJDNEM kész!

Az automatizálás **95%-ban telepítve van**. Csak **1 lépés** hiányzik:

---

## 🔐 1. Gmail App Password Beállítása

### Lépések (2 perc):

1. **Menj ide:** https://myaccount.google.com/apppasswords
   - Jelentkezz be: `kovasznai.gergely@gmail.com`

2. **Hozz létre App Password-öt:**
   - App name: `Alpha Agent` (vagy bármi)
   - Kattints: **Create**

3. **Másold ki a 16 karakteres kódot:**
   - Például: `abcd efgh ijkl mnop`

4. **Mentsd el a kódot:**
   ```bash
   cd "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"

   echo 'IDE_ILLESZD_BE_A_16_KARAKTERES_KODOT' > .gmail_app_password

   chmod 600 .gmail_app_password
   ```

5. **Teszteld:**
   ```bash
   python3 alpha_agent.py
   ```

   Ha minden OK, látni fogod:
   ```
   ✅ Email sikeresen elküldve: kovasznai.gergely@gmail.com
   ```

---

## 🎯 Mi történik most automatikusan?

### ⏰ Minden reggel 6:00-kor:
1. ✅ Seeking Alpha portfólió adatok gyűjtése
2. ✅ Elemzés készítése (top nyertesek, vesztesek, figyelmeztetések)
3. ✅ PDF jelentés generálása
4. ✅ Email küldése a jelentéssel
5. ✅ Fájlok mentése (TXT, MD, PDF)

### 📧 Email automatikusan:
- **Küldő:** kovasznai.gergely@gmail.com
- **Címzett:** kovasznai.gergely@gmail.com
- **Melléklet:** Portfolio_1_Jelentes_YYYY-MM-DD.pdf

---

## ✅ Ellenőrzések

### Cron Job (Automatikus Futás):
```bash
crontab -l
```

**Kimenet:**
```
0 6 * * * cd "..." && /usr/bin/python3 ".../alpha_agent.py" >> ".../alpha_agent.log" 2>&1
```
✅ **Ez azt jelenti, hogy minden reggel 6:00-kor automatikusan fut!**

### Manuális Teszt:
```bash
python3 alpha_agent.py
```

### Log Megtekintése:
```bash
tail -f alpha_agent.log
```

---

## 📁 Fájlok

### Automatikusan Generált (Naponta):
- `Portfolio_1_Jelentes_2026-01-22.txt` - Szöveges jelentés
- `Portfolio_1_Jelentes_2026-01-22.md` - Markdown formátum
- `Portfolio_1_Jelentes_2026-01-22.pdf` - PDF (email melléklet)
- `alpha_agent.log` - Futási napló

### Rendszer Fájlok:
- `alpha_agent.py` - Fő ügynök szkript
- `generate_pdf.py` - PDF generátor
- `install.sh` - Telepítő szkript
- `.gmail_app_password` - Gmail jelszó (TITKOS!)

---

## 🎉 Kész vagy!

Ha beállítottad a Gmail App Password-öt:
- ✅ **Minden reggel 6:00-kor automatikus email a jelentéssel**
- ✅ **Nem kell többet csinálnod semmit!**
- ✅ **Csak élvezd a napi jelentéseket!**

---

## 📞 Problémák?

### Email nem megy:
```bash
cat .gmail_app_password    # Ellenőrizd a jelszót
python3 alpha_agent.py     # Tesztelj
```

### Cron nem fut:
- macOS Beállítások → Adatvédelem → **Full Disk Access** → Add hozzá a Terminal-t

### További segítség:
```bash
cat README_AUTOMATION.md   # Részletes dokumentáció
cat INSTALL.md             # Telepítési útmutató
```

---

**🤖 Powered by Claude Alpha Agent**
**Investmentors Hungary Kft.**
