# 🔬 AI Research Pipeline - Teljes Csomag

**Brunella Agent System** | Verzió 1.0.0 | 2025-01-30

---

## 📦 Mit tartalmaz ez a csomag?

Egy teljes, production-ready AI kutatási rendszert, amely **automatikusan gyűjti és rendszerezi** a legújabb nyílt forráskódú AI innovációkat.

### Architektúra

```
Kutató Agent (Gemini 2.0 Flash)
    ↓
    ├── Perplexity API (real-time search)
    ├── ArXiv API (tudományos cikkek)
    ├── GitHub Trending (népszerű projektek)
    └── HuggingFace Papers (ML modellek)
    ↓
Text Parser (Python)
    ↓
Adattudós Agent (Ollama Llama 3.1 8B)
    ↓
JSON Validator + Dual Storage
    ↓
    ├── ChromaDB (semantic search)
    └── Google Drive JSON (backup)
```

---

## 📂 Fájlok

### Core Konfiguráció
- **`docker-compose.yml`** - Teljes stack (Langflow + Ollama + ChromaDB)
- **`.env.template`** - Environment variables sablon
- **`requirements.txt`** - Python dependencies

### Langflow Flow
- **`ai_research_pipeline.json`** - Import-ready flow definition

### Custom Tools (Python)
- **`perplexity_search_tool.py`** - Real-time web search
- **`arxiv_search_tool.py`** - Tudományos publikációk
- **`github_trending_tool.py`** - Népszerű GitHub repók
- **`huggingface_papers_tool.py`** - ML/AI papers

### Dokumentáció
- **`SETUP.md`** - Részletes telepítési útmutató
- **`README.md`** - Ez a fájl

### Teljes archívum
- **`ai-research-pipeline-complete.tar.gz`** - Minden fent felsorolt fájl

---

## 🚀 5 Perces Quick Start

### Előfeltételek
```bash
# Docker & Docker Compose telepítve
docker --version
docker-compose --version

# Minimum 16GB RAM
# 50GB szabad hely
```

### Telepítés

```bash
# 1. Archívum kicsomagolás
tar -xzf ai-research-pipeline-complete.tar.gz
cd ai-research-pipeline

# 2. Environment setup
cp .env.template .env
nano .env  # API key-ek kitöltése!

# 3. Könyvtárak létrehozása
mkdir -p backup custom_components
mv *.py custom_components/

# 4. Stack indítás
docker-compose up -d

# 5. Ollama model letöltése
docker exec -it ai-research-ollama ollama pull llama3.1:8b

# 6. Böngésző megnyitása
# http://localhost:7860
# Login: admin / admin123 (vagy ami a .env-ben van)
```

### Flow Import

1. Langflow UI → **Flows**
2. **Import** gomb
3. Válaszd ki: `ai_research_pipeline.json`
4. **Run** → Első futtatás!

---

## 🎯 Használati Példák

### Automatikus Napi Kutatás

A flow cron trigger-rel **minden reggel 9-kor** automatikusan fut:
- Összegyűjti a legfrissebb AI innovációkat
- Strukturálja JSON formátumba
- Elmenti ChromaDB-be (semantic search)
- Backup-ot készít JSON fájlban
- Telegram értesítést küld

### Semantic Search a Tudásbázisban

```python
import chromadb

client = chromadb.Client()
collection = client.get_collection("ai_innovations")

# Keresés
results = collection.query(
    query_texts=["multimodal large language models"],
    n_results=5
)

for result in results['documents'][0]:
    print(result)
```

### n8n Integráció

A Langflow API endpoint hozzáadható n8n-hez:
```
POST http://langflow:7860/api/v1/run/{flow_id}
```

Így összekötheted:
- Telegram bottal (Iszapfaló rendszer)
- Airtable-lel (tudásbázis tárolás)
- Google Drive-val (dokumentum generálás)

---

## 🛠️ Konfiguráció

### Szükséges API Key-ek (.env fájl)

```bash
# KÖTELEZŐ
GEMINI_API_KEY=AIzaSy...           # https://makersuite.google.com/app/apikey
PERPLEXITY_API_KEY=pplx-...        # https://www.perplexity.ai/settings/api

# OPCIONÁLIS
TELEGRAM_BOT_TOKEN=...             # BotFather
TELEGRAM_CHAT_ID=...               # @userinfobot
OPENAI_API_KEY=...                 # ha GPT modelleket is használnál
```

### Custom Components Telepítés

```bash
# Langflow konténerben
docker exec -it ai-research-langflow bash
pip install -r /app/custom_components/requirements.txt
```

---

## 📊 Flow Node-ok Részletesen

### 1. Cron Trigger
- **Időzítés:** Napi 9:00 CET
- **Trigger:** Automatikus flow indítás

### 2. Researcher Agent (Gemini 2.0 Flash)
- **Eszközök:**
  - Perplexity (web search)
  - ArXiv (papers)
  - GitHub (trending)
  - HuggingFace (ML models)
- **Output:** Markdown lista

### 3. Text Parser (Python)
- **Input:** Markdown
- **Művelet:** Regex parsing
- **Output:** Strukturált lista (JSON)

### 4. Data Scientist Agent (Ollama Llama 3.1)
- **Input:** Strukturálatlan lista
- **Művelet:** JSON normalizálás
- **Output:** Validated JSON schema

### 5. JSON Validator
- **Ellenőrzés:** Schema compliance
- **Tisztítás:** Duplicate removal, URL validation

### 6. Dual Storage Writer
- **ChromaDB:** Embedding generálás + vectorstore
- **File Backup:** JSON mentés timestamppal

### 7. Telegram Notifier
- **Értesítés:** Flow completion summary
- **Tartalom:** Statisztikák + backup link

---

## 🎨 Testreszabási Lehetőségek

### 1. Több Kategória Hozzáadása

Módosítsd a Researcher Agent promptját:
```python
Kategóriák: 
- LLM Modellek
- Ágensrendszerek
- RAG/VectorDB
- AutoML/AutoAgent
- Computer Vision    # ÚJ
- Reinforcement Learning  # ÚJ
```

### 2. Különböző LLM Használata

Researcher Agent → LLM dropdown:
- Claude 3.5 Sonnet (ha van API key)
- GPT-4 Turbo
- Mixtral 8x7B (Ollama)

### 3. Egyedi Tool Hozzáadása

```python
# Például: Reddit trending AI posts
class RedditAITool(CustomComponent):
    # ... implementáció
```

---

## 🔍 Troubleshooting

### GPU Support Hiányzik

```bash
# docker-compose.yml-ben:
# Uncomment az ollama service GPU section-ját

ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### ChromaDB Connection Error

```bash
# Health check
curl http://localhost:8000/api/v1/heartbeat

# Ha nem válaszol
docker-compose restart chromadb
```

### Langflow Flow Import Hiba

```bash
# Ellenőrizd a JSON syntax-ot
cat ai_research_pipeline.json | jq .

# Ha hibás, használd a backup verziót
```

---

## 📈 Következő Lépések

### 1. RAG Chatbot Építése
```python
# Streamlit app a ChromaDB-re
import streamlit as st
import chromadb

st.title("AI Innovation Search")
query = st.text_input("Mit keresel?")

# Semantic search a tudásbázisban
results = collection.query(query_texts=[query], n_results=10)
```

### 2. Google Drive Auto-upload

```python
# storage_dual_write node kiegészítés
from googleapiclient.discovery import build

service = build('drive', 'v3', credentials=creds)
file_metadata = {'name': filename, 'parents': [folder_id]}
service.files().create(body=file_metadata, media_body=filepath).execute()
```

### 3. Airtable Integráció

n8n workflow:
```
Langflow Webhook → Airtable Node
```

---

## 🆘 Support & Resources

### Dokumentáció
- Langflow: https://docs.langflow.org
- Ollama: https://ollama.ai/library
- ChromaDB: https://docs.trychroma.com

### Community
- Langflow Discord: https://discord.gg/langflow
- GitHub Issues: [projekt link]

---

## 📝 Changelog

### v1.0.0 (2025-01-30)
- ✅ Initial release
- ✅ 4 custom search tools
- ✅ Dual storage (ChromaDB + JSON)
- ✅ Telegram notifications
- ✅ Docker Compose stack

---

## 🙏 Credits

**Készítette:** Brunella Agent System  
**Alapok:** Langflow, Ollama, ChromaDB  
**Inspiráció:** ReAct, Tree-of-Thought  

---

## 📜 License

MIT License - Használd szabadon, módosítsd, bővítsd!

---

**🎉 Élvezd az automatizált AI kutatást!** 🚀
