# Iszapfaló Kft. - AI Mikroszolgáltatások (API)
*Verzió: 1.0.0 | Készült a Brunella Agent System keretében*

Ez a könyvtár egy önálló, Python (FastAPI) alapú mikroszolgáltatást tartalmaz, amely az Iszapfaló Kft. napi folyamatait hivatott AI segítségével automatizálni. 

Jelenleg két fő modult (végpontot) tartalmaz:
1. **Géppark és Eszköz "Egészség" Figyelő (`/diagnose`)**
2. **"Okos" Ajánlatadó Asszisztens (`/quote`)**

A megoldás 100%-ban kód-alapú, kiküszöbölve a "kattintgatós" UI (n8n/Langflow) felületek esetleges fagyásait és konfigurációs nehézségeit. Az adatok és a logika (Tudásbázis, RAG) be van égetve a `main.py` fájlba, így a szolgáltatás azonnal hordozható és skálázható.

---

## 1. Rendszerkövetelmények és Telepítés

A futtatáshoz csak egy Python 3.10+ környezet és egy OpenAI API kulcs szükséges.

**1. Lépj be a mappába:**
```bash
cd F:\mcp-brunella-core\myai\iszapfalo_api
```

**2. Telepítsd a függőségeket:**
```bash
pip install -r requirements.txt
```

---

## 2. A Szerver Indítása

A szerver futtatása előtt be kell állítanod a környezeti változót, amely tartalmazza az OpenAI API kulcsodat (amivel az LLM lekérdezések történnek).

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="sk-ide-másold-a-te-valódi-openai-kulcsodat"
python main.py
```

**Linux / macOS:**
```bash
export OPENAI_API_KEY="sk-ide-másold-a-te-valódi-openai-kulcsodat"
python main.py
```

A szerver alapértelmezetten a **8050**-es porton indul el (`http://localhost:8050`).

---

## 3. Végpontok (Endpoints) és Tesztelés

Miután elindítottad a szervert, egy új terminálból az alábbi parancsokkal tudod letesztelni a modulokat. Ezeket a végpontokat hívja majd az Iszapfaló n8n rendszere is (természetesen élesben a `localhost` helyett a hosztolt IP/domain szerepel majd).

### 3.1. Prediktív Karbantartás (`POST /diagnose`)
Elemzi a munkatársak szabad szöveges hibaüzeneteit a beépített gépkönyv alapján, és visszaadja a szükséges lépéseket és cikkszámokat.

**Példa kérés (PowerShell):**
```powershell
Invoke-RestMethod -Uri "http://localhost:8050/diagnose" -Method Post -ContentType "application/json" -Body '{"message": "Füstöl a kettes Truxor motorja és fogy az olaj."}' | ConvertTo-Json
```

**Várt válasz (JSON):**
```json
{
  "gep_id": "Truxor T40",
  "hiba_kategoria": "Motor/Olajrendszer",
  "surgosseg": "Kritikus",
  "javasolt_lepes": "AZONNAL leállítani! Ellenőrizni a hengerfejtömítést.",
  "szukseges_alkatreszek": [
    "Hengerfejtömítés készlet (TRX-ENG-001)",
    "5W-40 Motorolaj (O-5W40-10L)"
  ]
}
```

### 3.2. Okos Ajánlatadó (`POST /quote`)
Az ügyfél kérése és a cég belső árai/normái alapján elkészít egy ügyfélkész árajánlat-tervezetet Markdown formátumban.

**Példa kérés (PowerShell):**
```powershell
Invoke-RestMethod -Uri "http://localhost:8050/quote" -Method Post -ContentType "application/json" -Body '{"nev": "Példa Károly", "email": "karoly@peldamail.hu", "uzenet": "Van egy 800 m2-es nádas a nyaralómnál, le kéne vágni Truxorral. Kb. 30 km-re vagyunk Érdtől."}' | ConvertTo-Json
```

**Várt válasz (JSON):**
```json
{
  "ugyfel_neve": "Példa Károly",
  "ugyfel_email": "karoly@peldamail.hu",
  "kimeneti_ajanlat_markdown": "Tisztelt Példa Károly!\n\nKöszönjük megkeresését... [A formázott e-mail tartalma]"
}
```

---

## 4. Átadás az Iszapfaló Kft-nek (Integráció)

Mivel ez a szolgáltatás tisztán HTTP (REST) API-n keresztül kommunikál, az Iszapfaló számára a beüzemelés gyerekjáték:

1. Neked csak fel kell töltened ezt a pici Python szervert egy publikusan elérhető hosztra (pl. Render, Railway, vagy egy olcsó VPS).
2. Az Iszapfaló munkatársának be kell mennie a saját n8n rendszerébe (pl. a "Telegram Bejövő Üzenetek Feldolgozása" workflow-ba).
3. Be kell húzniuk egy **"HTTP Request"** node-ot.
4. A URL mezőbe beírják a te hosztolt címedet (pl. `https://te-szervered.render.com/diagnose`).
5. A Body-ba elküldik a Telegramból kinyert üzenetet: `{"message": "={{ $json.message }}"}`.
6. Kész! Az n8n megkapja a te szerveredtől a tiszta JSON választ (Sürgősség, Cikkszámok stb.), amit gond nélkül el tud menteni az Airtable adatbázisába.
