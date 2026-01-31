# Specification: Browser-Use Harvester with Structured JSON Output

## 1. Áttekintés
Ez a specifikáció a `myai/browser_worker.py` modul továbbfejlesztését írja le, amelynek célja, hogy strukturált JSON formátumban gyűjtsön adatokat a weboldalakról. Az új képesség a "Robotkéz" funkciót bővíti, lehetővé téve a gyűjtött adatok könnyű feldolgozását a Brunella Agent System más komponensei (pl. Refiner Factory, Dashboard, ChromaDB) számára.

## 2. Célkitűzések
- A `browser_worker.py` képessé tétele Pydantic modellek alapján történő strukturált adatkinyerésre.
- A kinyert adatok validálása és egységesítése JSON formátumban.
- Az adatgyűjtési folyamat hatékonyságának növelése a további feldolgozás automatizálásával.
- Integrációs pontok előkészítése vektor adatbázisokhoz (ChromaDB/LanceDB) és más downstream rendszerekhez.

## 3. Részletes Specifikáció

### 3.1. Adatkinyerési Logika
- A `browser_worker.py` kap egy `extraction_schema` paramétert (Pydantic modell JSON séma formájában).
- A "Robotkéz" (Gemini 1.5 Flash Vision) segítségével a weboldal tartalmából kinyeri az adatokat a séma alapján.
- A kinyert adatok validálása a Pydantic séma ellenében.
- Hiba esetén hibaüzenet, sikeres validáció esetén a strukturált JSON adat visszaadása.

### 3.2. Pydantic Modellek
- A felhasználó képes lesz Pydantic modelleket definiálni az elvárt kimeneti struktúrához (pl. `NewsArticle`, `ProductListing`, `JobPosting`).
- Ezek a modellek szerializálhatók és deszerializálhatók JSON-ná, biztosítva a rugalmasságot.

### 3.3. Integráció a Brunella Rendszerrel
- A `myai/refiner_logic.py` (vagy egy hasonló Refiner komponens) képes lesz közvetlenül fogadni és tovább feldolgozni a `browser_worker.py` által generált strukturált JSON kimenetet.
- Az adatok közvetlenül indexelhetők a ChromaDB-be vagy LanceDB-be, kihasználva a strukturált metadata előnyeit.

## 4. Elfogadási Kritériumok
- A `browser_worker.py` képes strukturált JSON kimenetet generálni egy adott Pydantic séma alapján.
- A generált JSON kimenet minden esetben valid, és megfelel az elvárt sémának.
- Hibás adatok vagy nem megfelelő séma esetén a modul releváns hibaüzenetet ad vissza.
- A funkció sikeresen tesztelhető különböző weboldalakkal és Pydantic sémákkal.

## 5. Kapcsolódó Dokumentumok
- `myai/browser_worker.py` (célfájl)
- `myai/refiner_logic.py` (integrációs pont)
- `conductor/product.md` (Termék Definíció)
- `conductor/tech-stack.md` (Tech Stack)
