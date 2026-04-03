# 🚀 Alpha Agent - Gyors Telepítési Útmutató

## Lépések (5 perc alatt kész!)

### 1️⃣ Nyisd meg a Terminal-t

### 2️⃣ Navigálj a mappába
```bash
cd "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"
```

### 3️⃣ Futtasd a telepítő szkriptet
```bash
./setup_automation.sh
```

**VAGY** ha nem működik:
```bash
bash setup_automation.sh
```

### 4️⃣ Add meg a Gmail App Password-öt

A szkript kérni fogja a Gmail App Password-öt.

**Hogyan szerezd meg:**
1. Menj ide: https://myaccount.google.com/security
2. Kattints: **2-Step Verification** (ha nincs bekapcsolva, kapcsold be)
3. Görgess le: **App passwords**
4. Válaszd ki: **Mail** és **Mac**
5. Kattints: **Generate**
6. Másold ki a **16 karakteres kódot** (pl: `abcd efgh ijkl mnop`)
7. Illeszd be a Terminal-ba amikor kéri

### 5️⃣ Kész! ✅

A rendszer most automatikusan fog futni **minden reggel 6:00-kor**.

---

## 🎯 Mi történik automatikusan?

**Minden nap 6:00-kor:**
- 📊 Összegyűjti a portfólió adatokat
- 📝 Elemzést készít
- 📄 PDF jelentést generál
- 📧 Email-t küld neked a jelentéssel
- 💾 Fájlokat ment (TXT, MD, PDF)

**Nem kell többet csinálnod semmit!**

---

## ✅ Ellenőrzés

### Cron job ellenőrzése
```bash
crontab -l
```

Látnod kell egy sort:
```
0 6 * * * cd "..." && /usr/bin/python3 ".../alpha_agent.py" >> ".../alpha_agent.log" 2>&1
```

### Manuális teszt futtatás
```bash
python3 alpha_agent.py
```

Ha minden rendben, látnod kell:
```
🚀 Alpha Agent indítása...
📅 Időpont: 2026-01-22 08:50:00
...
✅ Alpha Agent sikeresen lefutott!
```

---

## 📧 Mikor kapok emailt?

- **Automatikusan:** Minden reggel 6:00-kor
- **Manuálisan:** Amikor futtatod: `python3 alpha_agent.py`

---

## 🛠️ Problémák?

### Email nem megy?
1. Ellenőrizd a Gmail App Password-öt:
   ```bash
   cat .gmail_app_password
   ```
2. Ha rossz, töröld és futtasd újra a telepítőt:
   ```bash
   rm .gmail_app_password
   ./setup_automation.sh
   ```

### Cron nem fut?
1. macOS esetén add meg a Terminal jogosultságokat:
   - Rendszerbeállítások → Adatvédelem és biztonság
   - **Full Disk Access** → Add hozzá a Terminal-t
2. Próbáld újra:
   ```bash
   ./setup_automation.sh
   ```

---

## 📞 További segítség

Ha bármi nem működik, nézd meg a részletes dokumentációt:
```bash
cat README_AUTOMATION.md
```

Vagy nézd meg a log fájlt:
```bash
tail -f alpha_agent.log
```

---

**🎉 Ennyi! Most már teljesen automatikus minden!**
