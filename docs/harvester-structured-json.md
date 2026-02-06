# Robotkéz Harvester – Strukturált JSON Adatkinyerés

A Browser-Use (Robotkéz) modul Pydantic alapú, JSON-séma vezérelt adatkinyerést végez weboldalakról. A kinyert adatok validált JSON formátumban érkeznek, készen a Refiner, LanceDB vagy ChromaDB feldolgozására.

---

## 1. Gyors indulás

### Környezet

```bash
# .env
GOOGLE_API_KEY=...   # vagy GEMINI_API_KEY
```

```bash
pip install browser-use pydantic python-dotenv
```

### Példa futtatás (CLI)

```bash
# Scenario fájlból (extraction_schema + target_url a JSON-ben)
python myai/browser_worker.py myai/scenarios/harvester_extraction_example.json

# Közvetlen extract mód
python myai/browser_worker.py --extract \
  --schema myai/scenarios/job_posting_schema.json \
  --url "https://example.com/jobs" \
  --prompt "Találd meg az első álláshirdetés adatait."
```

---

## 2. JSON séma definiálása

A séma standard JSON Schema formátumban adható meg. A `required` mezők kötelezőek, a többi opcionális.

### Példa: Álláshirdetés (JobPosting)

```json
{
  "title": "JobPosting",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "company": { "type": "string" },
    "location": { "type": "string" },
    "salary": { "type": "string" },
    "url": { "type": "string" }
  },
  "required": ["title", "company", "url"]
}
```

Fájl: `myai/scenarios/job_posting_schema.json`

### Példa: Hírcikk (NewsArticle)

```json
{
  "title": "NewsArticle",
  "type": "object",
  "properties": {
    "headline": { "type": "string" },
    "author": { "type": "string" },
    "date": { "type": "string" },
    "summary": { "type": "string" },
    "url": { "type": "string" }
  },
  "required": ["headline", "url"]
}
```

### Példa: Termék (ProductListing)

```json
{
  "title": "ProductListing",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "price": { "type": "string" },
    "currency": { "type": "string" },
    "availability": { "type": "string" },
    "url": { "type": "string" }
  },
  "required": ["name", "price", "url"]
}
```

---

## 3. Scenario fájl (extraction mód)

Ha `extraction_schema` és `extraction` (vagy `extraction_prompt`) szerepel a scenario-ban, a worker strukturált kinyerésre vált.

```json
{
  "scenario_name": "harvester_job_posting_example",
  "mode": "ui",
  "target_url": "https://example.com/jobs",
  "extraction_schema": "myai/scenarios/job_posting_schema.json",
  "extraction_prompt": "Találd meg az első álláshirdetés adatait a listából.",
  "steps": [
    {
      "action": "click",
      "description": "Nyisd meg az első álláshirdetést (ha szükséges)."
    }
  ]
}
```

| Mező | Kötelező | Leírás |
|------|----------|--------|
| `extraction_schema` | igen | JSON séma fájl útvonala vagy raw JSON string |
| `extraction_prompt` | nem | Feladat leírás az LLM-nek (alapértelmezett: általános kinyerés) |
| `target_url` | nem | Kezdő URL (alapértelmezett: localhost:5678) |
| `steps` | nem | Opcionális lépések (pl. kattintás, scroll) |
| `model` | nem | Gemini modell (alapértelmezett: gemini-1.5-flash) |

---

## 4. CLI paraméterek (--extract)

| Paraméter | Kötelező | Leírás |
|-----------|----------|--------|
| `--extract` | igen | Extract mód aktiválása |
| `--schema` | igen | Séma fájl vagy JSON string |
| `--url` | nem | Cél URL (alapértelmezett: http://localhost:5678) |
| `--prompt` | nem | Kinyerési utasítás |

---

## 5. Kimenet formátum

Siker esetén:

```json
{
  "data": {
    "title": "Python Developer",
    "company": "ACME Kft.",
    "location": "Budapest",
    "salary": "competitive",
    "url": "https://example.com/job/123"
  },
  "raw_output": "..."
}
```

Hiba esetén:

```json
{
  "error": "Validation failed: ...",
  "raw_output": "..."
}
```

---

## 6. Integráció a Refinerrel

A `myai/refiner_logic.py` képes fogadni a strukturált JSON-t. A `DataRefiner.process_data()` a `content` mezőben várja a szöveget; a Harvester kimenetét át lehet alakítani:

```python
# Példa: Harvester kimenet -> Refiner
harvest_result = await run_structured_extraction(config, schema_path)
if "data" in harvest_result:
    content = json.dumps(harvest_result["data"], ensure_ascii=False)
    await refiner.process_data({"content": content, "source": "harvester"})
```

---

## 7. Kapcsolódó fájlok

| Fájl | Cél |
|------|-----|
| `myai/browser_worker.py` | `run_structured_extraction()`, `_load_schema_source()`, `validate_with_schema` |
| `myai/pydantic_models.py` | `validate_with_schema()`, `build_model_from_json_schema()` |
| `myai/scenarios/job_posting_schema.json` | Példa séma |
| `myai/scenarios/harvester_extraction_example.json` | Példa scenario |
| `myai/refiner_logic.py` | ChromaDB/LanceDB mentés |
| `conductor/tracks/browser_use_harvester_20260131/` | Spec és terv |
