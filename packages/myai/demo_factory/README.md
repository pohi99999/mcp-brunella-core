# Brunella AI Demo Factory
*Verzió: 1.0.0 | Készült a Brunella Agent System keretében*

Ez a könyvtár egy automatizált "AI Prototípus Gyárat" valósít meg. A cél, hogy a Trójai Faló kampány keretében gyűjtött leadek számára (KKV-k, középvállalkozások) azonnal működő, személyre szabott AI asszisztens demókat tudjunk prezentálni.

---

## 🏗️ Felépítés

### 1. Sablonok (`/templates`)
Iparág-specifikus, általánosított FastAPI kódok.
- `accounting_api.py`: Könyvelőirodáknak (Adótanácsadó + Onboarding).
- `real_estate_api.py`: Ingatlanirodáknak (Hirdetés-alapú válaszadás).

### 2. Éles Demók (Gyökérkönyvtár)
Konkrét cégekre szabott, a weboldaluk elemzése alapján betanított API-k.
- `active_a_konyvelo_demo.py`: Aktív-A Könyvelőiroda (Debrecen) demója.
- `nagyerdei_ingatlan_demo.py`: Nagyerdei Ingatlaniroda (Debrecen) demója.

---

## 🚀 Használati Utasítás

### A szerver elindítása
Válaszd ki a tesztelni kívánt demót és indítsd el a megfelelő porton:

**Könyvelő (Port 8071):**
```powershell
$env:OPENAI_API_KEY="sk-..."
python active_a_konyvelo_demo.py
```

**Ingatlan (Port 8061):**
```powershell
$env:OPENAI_API_KEY="sk-..."
python nagyerdei_ingatlan_demo.py
```

### Tesztelés (PowerShell)
Küldj egy fiktív ügyfélkérést az API-nak:

```powershell
# Könyvelő teszt
Invoke-RestMethod -Uri "http://localhost:8071/ask" -Method Post -ContentType "application/json" -Body '{"user_query": "Mennyibe kerül nálatok egy cégalapítás?"}' | ConvertTo-Json

# Ingatlan teszt
Invoke-RestMethod -Uri "http://localhost:8061/handle_inquiry" -Method Post -ContentType "application/json" -Body '{"customer_message": "Kiadó lakást keresek a Nagyerdő közelében."}' | ConvertTo-Json
```

---

## 🎯 Stratégia (Trójai Faló Wave 3)

1. **Lead gyűjtés:** A Lead Intelligence Worker kigyűjti a cégeket.
2. **Web elemzés:** A RobotkezV2 kigyűjti az árakat, szolgáltatásokat és stílust.
3. **Generálás:** Új fájl létrehozása a gyökérben a megfelelő sablon alapján.
4. **Outreach:** A generált Markdown e-mail sablon kiküldése az ügyfélnek, benne a működő demóból származó idézetekkel.
