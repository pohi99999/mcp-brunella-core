# ⚡ GYORS ÚTMUTATÓ - EKR Agent

## 🎯 Ha új Claude Code munkamenetet indítasz

Egyszerűen írd be:

```
"EKR"
```

És kész! 🎉

---

## 📝 MIT FOG CSINÁLNI?

1. ✅ Belép az EKR-be (SMS kódot kér)
2. ✅ Lefuttatja a 9 fő kulcsszavas keresést
3. ✅ **Csak aktív tendereket** mutat (nem járt le a határidő)
4. ✅ Generál JSON + Markdown riportot
5. ✅ Riportok helye: `results/` mappa

---

## 🔧 VÁLTOZATOK

### Minden tender (aktív + lezárt)
```
"Futtasd az EKR-t minden tenderrel"
```

### Egyedi kulcsszó
```
"Keress az EKR-ben 'híd építés' kulcsszóval"
```

### Több kulcsszó
```
"Keress az EKR-ben ezekkel: iszapkotrás, kotrógép"
```

---

## 📊 HOL VANNAK AZ EREDMÉNYEK?

```
results/
├── ekr_search_2025-12-03_14-30.json
└── ekr_report_2025-12-03_14-30.md
```

**JSON**: Részletes adatok (gépi feldolgozásra)
**Markdown**: Olvasható riport (embereknek)

---

## 🚨 HIBAELHÁRÍTÁS

### "Hiányzó credentials"
→ Állítsd be a környezeti változókat:
```bash
export EKR_USERNAME="your_email@example.com"
export EKR_PASSWORD="your_password"
```

### SMS kód nem érkezik
→ Ellenőrizd az EKR profilodban a telefonszámot

### ChromeDriver hiba
→ Telepítsd: `brew install chromedriver`

---

## 💡 TIPPEK

1. **Első futtatás előtt**: Állítsd be a credentials-t
2. **SMS kód**: Legyen kéznél a telefonod
3. **Eredmények**: Nézd meg a Markdown riportot, szebb
4. **Gyakoriság**: Futtasd hetente egyszer (hétfőnként)

---

## ❓ KÉRDÉSEK?

Kérdezz Claude-tól bármit:
- "Hogyan módosítom a kulcsszavakat?"
- "Hogyan futtassam automatikusan hetente?"
- "Hogyan exportálom Excelbe az eredményeket?"

Claude segít! 🤖

---

**🎉 Ennyi! Egyszerű, nem? Próbáld ki!**
