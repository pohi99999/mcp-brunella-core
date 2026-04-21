# AI Research Pipeline - Setup Útmutató

## 📦 Rendszerkövetelmények

- Docker & Docker Compose
- Python 3.10+ (lokális fejlesztéshez)
- NVIDIA GPU (opcionális, Ollama GPU support-hoz)
- 16GB+ RAM (32GB ajánlott Ollama modellekhez)
- 50GB+ szabad tárhely

---

## 🚀 Gyors Telepítés (5 perc)

### 1. Fájlok előkészítése

```bash
# Hozz létre egy working directory-t
mkdir ai-research-pipeline
cd ai-research-pipeline

# Másold be a fájlokat:
# - docker-compose.yml
# - .env.template
# - ai_research_pipeline.json
# - Python tool fájlok (*.py)

# Készítsd el a .env fájlt
cp .env.template .env
nano .env  # Töltsd ki az API key-eket!
```

### 2. Könyvtárstruktúra

```bash
# Hozd létre a szükséges könyvtárakat
mkdir -p backup
mkdir -p custom_components
mv *.py custom_components/

# Végső struktúra:
# ai-research-pipeline/
# ├── docker-compose.yml
# ├── .env
# ├── ai_research_pipeline.json
# ├── backup/
# └── custom_components/
#     ├── perplexity_search_tool.py
#     ├── arxiv_search_tool.py
#     ├── github_trending_tool.py
#     └── huggingface_papers_tool.py
```

### 3. Docker Stack indítása

```bash
# Stack indítás
docker-compose up -d

# Logok ellenőrzése
docker-compose logs -f

# Várj amíg minden service healthy lesz (1-2 perc)
docker-compose ps
```

### 4. Ollama modellek letöltése

```bash
# Csatlakozz az Ollama konténerhez
docker exec -it ai-research-ollama bash

# Töltsd le a Llama 3.1 8B modellt
ollama pull llama3.1:8b

# Teszteld
ollama run llama3.1:8b "Hello, test message"

# Kilépés
exit
```

### 5. Langflow hozzáférés

```bash
# Nyisd meg a böngészőben
# http://localhost:7860

# Bejelentkezés:
# - Username: admin (vagy amit beállítottál a .env-ben)
# - Password: admin123 (vagy amit beállítottál)
```

---

## 🔧 Langflow Konfiguráció

### 1. Custom Components telepítése

```bash
# Langflow konténerben
docker exec -it ai-research-langflow bash

# Python dependencies
pip install arxiv requests langchain-community

# Másold a custom component-eket
# (Ha külső volume-ról szeretnéd)
```

### 2. LLM Providers beállítása

A Langflow UI-ban:

**Settings → Model Providers:**

1. **Ollama (Local)**
   - Provider: Custom OpenAI Compatible
   - Base URL: `http://ollama:11434/v1`
   - Model: `llama3.1:8b`
   - API Key: `ollama` (bármi, nem használt)

2. **Google Gemini**
   - Provider: Google
   - API Key: (a .env-ből)
   - Model: `gemini-2.0-flash-exp`

3. **Perplexity**
   - Provider: Custom OpenAI Compatible
   - Base URL: `https://api.perplexity.ai`
   - API Key: (a .env-ből)
   - Model: `llama-3.1-sonar-large-128k-online`

### 3. Flow Import

1. Langflow UI → **Flows** tab
2. **Import** gomb
3. Válaszd ki az `ai_research_pipeline.json` fájlt
4. **Import** → Flow betöltve!

---

## 🎯 Használat

### Első Flow Futtatás

1. **Langflow UI-ban:**
   - Nyisd meg az "AI Research Pipeline" flow-t
   - Ellenőrizd a node-ok konfigurációját
   - **Run** gomb → Flow indítás

2. **Eredmények ellenőrzése:**
   ```bash
   # ChromaDB tartalom
   curl http://localhost:8000/api/v1/collections/ai_innovations/count
   
   # Backup fájlok
   ls -lh backup/
   ```

3. **Telegram értesítés:**
   - Ha helyesen konfiguráltad, kapsz egy értesítést

---

## 🔍 Troubleshooting

### Ollama GPU support

```bash
# NVIDIA driver ellenőrzés
nvidia-smi

# Docker Compose módosítás szükséges:
# Uncomment a GPU deployment section-t a docker-compose.yml-ben

# Stack újraindítás
docker-compose down
docker-compose up -d
```

### ChromaDB connection timeout

```bash
# Ellenőrizd a ChromaDB health-et
curl http://localhost:8000/api/v1/heartbeat

# Ha nem válaszol, restart
docker-compose restart chromadb
```

### Langflow custom components nem működnek

```bash
# Belépés a konténerbe
docker exec -it ai-research-langflow bash

# Dependencies telepítés
pip install arxiv requests python-dotenv

# Langflow restart
docker-compose restart langflow
```

---

## 📊 Monitoring

### Docker Stats

```bash
# Resource használat
docker stats

# Logs real-time
docker-compose logs -f langflow
docker-compose logs -f ollama
```

### ChromaDB Dashboard

```bash
# Collection info
curl http://localhost:8000/api/v1/collections/ai_innovations | jq

# Query test
curl -X POST http://localhost:8000/api/v1/collections/ai_innovations/query \
  -H "Content-Type: application/json" \
  -d '{
    "query_texts": ["large language models"],
    "n_results": 5
  }' | jq
```

---

## 🔐 Biztonsági Megjegyzések

1. **API Key-ek védése:**
   ```bash
   # .env fájl jogosultságok
   chmod 600 .env
   
   # Ne commitold a .env-et Git-be!
   echo ".env" >> .gitignore
   ```

2. **ChromaDB authentication:**
   - Produkcióban MINDIG változtasd meg a `CHROMA_AUTH_TOKEN`-t!
   - Használj erős, random generált tokent

3. **Langflow admin jelszó:**
   - Változtasd meg a default admin123-at azonnal!

---

## 🚀 Következő Lépések

1. **Flow testreszabása:**
   - Adj hozzá több kategóriát
   - Finomhangold a prompt-okat
   - Bővítsd a metadata mezőket

2. **Google Drive integráció:**
   - Service account létrehozása
   - Drive API aktiválás
   - Backup upload automatizálás

3. **n8n integráció:**
   - Langflow API endpoint hozzáadása n8n-hez
   - Telegram bot összekötés
   - Airtable sink konfiguráció

4. **Semantic search UI:**
   - Streamlit dashboard építése ChromaDB-re
   - RAG chatbot a tudásbázishoz

---

## 📚 Hasznos Parancsok

```bash
# Stack leállítás
docker-compose down

# Stack törlés (volumes-zal együtt!)
docker-compose down -v

# Csak egy service újraindítása
docker-compose restart langflow

# Logok egy service-től
docker-compose logs -f ollama --tail 100

# Shell egy konténerben
docker exec -it ai-research-langflow bash

# Resource cleanup
docker system prune -a
```

---

## 🆘 Support

Ha problémád van:
1. Ellenőrizd a logokat: `docker-compose logs`
2. Nézd meg a health status-t: `docker-compose ps`
3. Próbáld meg újraindítani: `docker-compose restart`

---

**Készítette:** Brunella Agent System  
**Verzió:** 1.0.0  
**Utolsó frissítés:** 2025-01-30
