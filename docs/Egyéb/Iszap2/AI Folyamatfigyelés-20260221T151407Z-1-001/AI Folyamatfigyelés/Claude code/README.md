# 🤖 Tender Monitoring System - Iszapfaló Kft.

Automatizált tender keresési és monitoring rendszer közbeszerzési forrásokból.

---

## 🚀 GYORS INDÍTÁS

### Claude Code-ból (AJÁNLOTT)

Indíts új munkamenetet és egyszerűen írd be:

```
"EKR"
```

Vagy paraméterekkel:

```
"Futtasd az EKR ügynököt minden tenderrel"  → --all flag
"EKR keresés csak iszapkotrás kulcsszóval"  → --keyword filter
```

### Parancsssorból

```bash
# Alapértelmezett: csak aktív tenderek
python run_agent.py EKR

# Minden tender (aktív + lezárt)
python run_agent.py EKR --all

# Egyedi kulcsszó
python run_agent.py EKR --keyword "iszapkotrás"

# Több kulcsszó
python run_agent.py EKR --keyword "iszapkotrás" --keyword "vízépítés"

# Credentials megadása
python run_agent.py EKR --username email@example.com --password mypass
```

---

## 📋 ÜGYNÖKÖK

### ✅ EKR Agent (KÉSZ)

**Forrás**: Elektronikus Közbeszerzési Rendszer (EKR)
**Státusz**: ✅ Működik
**Kulcsszavak**: 9+4 db (iszapkotrás, mederkotrás, vízépítés, stb.)

**Funkciók:**
- ✅ Automatikus belépés (SMS kód szükséges)
- ✅ Kulcsszavas keresés több kategóriában
- ✅ Csak aktív tenderek szűrése (alapértelmezett)
- ✅ JSON + Markdown riportok
- ✅ Teljes naplózás

**Paraméterek:**
- `--all` - Minden tender (nem csak aktív)
- `--keyword KULCSSZÓ` - Egyedi kulcsszó (többször használható)
- `--username EMAIL` - EKR felhasználónév
- `--password PASS` - EKR jelszó

---

## ⚙️ TELEPÍTÉS ÉS BEÁLLÍTÁS

### 1. Környezeti változók beállítása (AJÁNLOTT)

Hozz létre egy `.env` fájlt:

```bash
EKR_USERNAME=your_email@example.com
EKR_PASSWORD=your_password
```

Vagy exportáld őket:

```bash
export EKR_USERNAME="your_email@example.com"
export EKR_PASSWORD="your_password"
```

### 2. Python függőségek telepítése

```bash
pip install selenium
```

### 3. ChromeDriver telepítése

- Töltsd le: https://chromedriver.chromium.org/
- Vagy macOS-en: `brew install chromedriver`

---

## 📊 EREDMÉNYEK

Az ügynökök az eredményeket a `results/` mappába mentik:

```
results/
├── ekr_search_2025-12-03_14-30.json    # JSON formátumban
└── ekr_report_2025-12-03_14-30.md      # Markdown riport
```

### JSON kimenet példa:

```json
{
  "search_session": {
    "session_id": "2025-12-03_14-30",
    "start_time": "2025-12-03T14:30:00",
    "status": "completed",
    "only_active": true
  },
  "search_results": [
    {
      "search_id": 1,
      "keyword": "iszapkotrás",
      "priority": "magas_prioritas",
      "results_count": 23,
      "url": "https://ekr.gov.hu/...",
      "status": "completed"
    }
  ],
  "performance_metrics": {
    "total_searches_planned": 13,
    "searches_completed": 13,
    "total_results_found": 66,
    "coverage_percentage": 100
  }
}
```

### Markdown riport példa:

```markdown
# 🔍 EKR Keresési Riport - Iszapfaló Kft.

**Session ID**: 2025-12-03_14-30
**Dátum**: 2025-12-03 14:30
**Státusz**: ✅ BEFEJEZVE
**Szűrő**: 🟢 Csak aktív tenderek

## 📊 Összesítés

- Tervezett keresések: 13 db
- Végrehajtott keresések: 13 db
- **Összes találat**: **66 tender**
- Lefedettség: 100%

## 🎯 Részletes Eredmények...
```

---

## 🗂️ PROJEKT STRUKTÚRA

```
.
├── agents/
│   └── ekr_agent.py          # EKR ügynök
├── results/                   # Generált riportok
│   ├── ekr_search_*.json
│   └── ekr_report_*.md
├── run_agent.py              # Egyszerű indító script
├── README.md                 # Ez a fájl
├── RENDSZERTERV.md           # Teljes rendszer terv
└── DASHBOARD_LATVÁNYTERV.md  # Dashboard látványterv
```

---

## 💡 HASZNÁLATI PÉLDÁK

### Példa 1: Napi rutin ellenőrzés (Claude Code)

```
"EKR"
```

→ Lefuttatja az EKR ügynököt csak aktív tenderekkel
→ Eredmények: `results/ekr_search_*.json` és `.md`

### Példa 2: Teljes közbeszerzési áttekintés

```
"Futtasd az EKR ügynököt minden tenderrel"
```

→ Claude értelmezi: `python run_agent.py EKR --all`
→ Minden tender (aktív + lezárt) keresése

### Példa 3: Egyedi keresés

```
"Keress az EKR-ben 'híd építés' kulcsszóval"
```

→ Claude értelmezi: `python run_agent.py EKR --keyword "híd építés"`

### Példa 4: Manuális futtatás (terminál)

```bash
# Csak aktív tenderek (alapértelmezett)
python run_agent.py EKR

# Minden tender
python run_agent.py EKR --all

# Egyedi kulcsszavakkal
python run_agent.py EKR --keyword "iszapkotrás" --keyword "kotrógép"
```

---

## 🔄 KÖVETKEZŐ LÉPÉSEK (Jövőbeli ügynökök)

### Agent 2: Közbeszerzési Értesítő Monitor (TERVEZETT)
- Forrás: Közbeszerzési Értesítő
- Kulcsszavak: + CPV kódok
- Futás: Naponta

### Agent 3: EU TED Monitor (TERVEZETT)
- Forrás: Tenders Electronic Daily (EU)
- Kulcsszavak: Angol fordítások
- Futás: Hetente

### Agent 4: Helyi Tender Monitor (TERVEZETT)
- Forrás: Megyei/városi önkormányzatok
- Kulcsszavak: Helyi módosítások
- Futás: Hetente kétszer

### Orchestrator (TERVEZETT)
- Mind a 4 ügynök koordinálása
- Deduplikáció
- Összesített riportok
- Dashboard integráció

---

## 🛠️ TROUBLESHOOTING

### Probléma: "Hiányzó credentials"

**Megoldás**: Állítsd be a környezeti változókat vagy add meg paraméterként:

```bash
export EKR_USERNAME="email@example.com"
export EKR_PASSWORD="password"
```

### Probléma: "ChromeDriver hiba"

**Megoldás**: Telepítsd a ChromeDriver-t:

```bash
# macOS
brew install chromedriver

# Vagy töltsd le: https://chromedriver.chromium.org/
```

### Probléma: SMS kód nem érkezik

**Megoldás**: Ellenőrizd az EKR profilodat, hogy jó telefonszám van-e beállítva.

---

## 📞 TÁMOGATÁS

Ha új funkciót szeretnél vagy hibát találsz:

1. Nyiss új Claude Code munkamenetet
2. Mondd el a problémát/kérést
3. Claude segít a kód módosításában/hibajavításban

---

## 📄 LICENC & TULAJDONOS

**Tulajdonos**: Iszapfaló Kft.
**Fejlesztve**: Claude Code segítségével
**Verzió**: 1.0
**Dátum**: 2025-12-03

---

**🎉 Boldog tender vadászatot!** 🚀
