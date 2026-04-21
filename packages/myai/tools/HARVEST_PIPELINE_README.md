# Tech-Harvester Pipeline - Complete Usage Guide

**Track:** TR-20260212-TECH-HAR
**Status:** ✅ COMPLETED (100%)
**Created:** 2026-02-13

---

## 🎯 Overview

Complete self-learning pipeline for autonomous AI/Tech knowledge acquisition:

```
Harvest (scrape sources) → Refine (LLM summary) → Integrate (LanceDB + Golden Dataset)
```

**Components:**
1. **tech_harvester.py** - Scrape AI/Tech sources (GitHub, Vercel, LangChain, etc.)
2. **knowledge_integrator.py** - Refine, deduplicate, store (LanceDB RAG + Golden Dataset)
3. **harvest_pipeline.py** - End-to-end orchestration wrapper
4. **CLI Command** - `brunella harvest run` (one-command execution)

---

## 🚀 Quick Start

### Option 1: CLI Command (Recommended)

```bash
# Run complete pipeline (harvest + integrate)
brunella harvest run

# Check last harvest summary
brunella harvest status
```

### Option 2: Manual Pipeline

```bash
# Step 1: Harvest
cd myai
python agents/tech_harvester.py --mode playwright

# Step 2: Integrate (use latest harvest file)
python tools/knowledge_integrator.py temp/harvest_results/harvest_results_<timestamp>.json

# Alternative: Run pipeline wrapper
python tools/harvest_pipeline.py
```

---

## 📋 Prerequisites

### Python Dependencies

```bash
# Core dependencies
pip install playwright requests numpy pydantic

# Playwright browsers
playwright install chromium

# Optional: LanceDB (RAG storage)
pip install lancedb pyarrow

# Optional: Browser-Use (intelligent mode)
pip install browser-use langchain-ollama
```

### Ollama (LLM for summarization)

```bash
# Install Ollama: https://ollama.ai

# Pull model
ollama pull qwen2.5-coder:latest

# Start server
ollama serve
```

---

## 🔧 Configuration

**File:** `myai/config/sources.json`

### Configured Sources (6)

| Source | URL | Type | Status |
|--------|-----|------|--------|
| GitHub Trending AI | github.com/trending/python | list | ✅ Enabled |
| GitHub MCP Servers | github.com/modelcontextprotocol/servers | docs | ✅ Enabled |
| Vercel AI SDK Docs | sdk.vercel.ai/docs | docs | ✅ Enabled |
| LangChain Blog | blog.langchain.dev | article | ✅ Enabled |
| Anthropic Docs | docs.anthropic.com | docs | ❌ Disabled |
| HuggingFace Papers | huggingface.co/papers | list | ✅ Enabled |

### Settings

```json
{
  "harvesterSettings": {
    "maxItemsPerSource": 5,
    "timeoutSeconds": 60,
    "headless": true
  },
  "refinementSettings": {
    "minRelevanceScore": 0.6,
    "summaryMaxTokens": 500,
    "deduplicationThreshold": 0.85
  }
}
```

---

## 📊 Pipeline Workflow

### Phase 1: Harvesting

**Script:** `myai/agents/tech_harvester.py`

**Input:** `myai/config/sources.json`
**Output:** `temp/harvest_results/harvest_results_{timestamp}.json`

**What it does:**
1. Load 6 configured sources
2. Navigate to each URL (Playwright/Browser-Use)
3. Extract content (CSS selectors or LLM agent)
4. Filter by keywords (relevance check)
5. Save structured JSON (max 5 items per source)

**Example Output:**
```json
{
  "harvested_at": "2026-02-13T04:00:00Z",
  "total_items": 23,
  "sources": ["GitHub Trending AI", ...],
  "items": [
    {
      "source": "GitHub Trending AI",
      "content": "New MCP server for SQLite...",
      "timestamp": "2026-02-13T04:00:00Z"
    }
  ]
}
```

---

### Phase 2: Integration

**Script:** `myai/tools/knowledge_integrator.py`

**Input:** Harvest results JSON
**Output:** LanceDB vectors + Golden Dataset JSONL

**What it does:**
1. **Validate** - Pydantic schema validation
2. **Summarize** - LLM (Ollama qwen2.5-coder) 2-3 sentence summary
3. **Embed** - Generate vector embeddings
4. **Deduplicate** - Cosine similarity (threshold: 0.85)
5. **Store LanceDB** - Vector storage for RAG (`data/brunella_lancedb/tech_trends`)
6. **Golden Dataset** - Append instruction tuning JSONL (`myai/incubator/training_data.jsonl`)

**Golden Dataset Format:**
```json
{
  "instruction": "What are the latest developments in AI and technology?",
  "input": "",
  "output": "Based on recent findings from GitHub Trending AI:\n\nNew MCP server enables SQLite database integration with AI agents...\n\nKeywords: MCP, SQLite, Agent",
  "metadata": {
    "source": "GitHub Trending AI",
    "timestamp": "2026-02-13T04:00:00Z"
  }
}
```

---

## 🎮 Usage Examples

### Example 1: Run Full Pipeline (CLI)

```bash
brunella harvest run
```

**Output:**
```
╔════════════════════════════════════════════════════════════════╗
║           TECH-HARVESTER PIPELINE                          ║
╚════════════════════════════════════════════════════════════════╝

[PHASE 1: HARVESTING]
[PLAYWRIGHT] Harvesting: GitHub Trending AI
[OK] Playwright extracted 5 items from GitHub Trending AI
...

[PHASE 2: INTEGRATION]
Validating items...
Refined 23 items
Removed 3 duplicates. 20 unique items.
LanceDB inserted: 20
Golden Dataset appended: 20

╔════════════════════════════════════════════════════════════════╗
║           HARVEST PIPELINE COMPLETED                       ║
╚════════════════════════════════════════════════════════════════╝

  Duration: 145.32 seconds
  Items Harvested: 23
  Items Integrated: 20
  LanceDB Inserted: 20
  Golden Dataset Appended: 20
```

### Example 2: Check Last Harvest Status

```bash
brunella harvest status
```

**Output:**
```
═══════════════════════════════════════════════════════════════
LAST HARVEST SUMMARY
═══════════════════════════════════════════════════════════════
Duration: 145.32 seconds
Items Harvested: 23
Items Integrated: 20
LanceDB Inserted: 20
Golden Dataset Appended: 20
═══════════════════════════════════════════════════════════════
```

### Example 3: Manual Harvest Only

```bash
python myai/agents/tech_harvester.py --mode playwright --log-level DEBUG
```

### Example 4: Manual Integration Only

```bash
python myai/tools/knowledge_integrator.py temp/harvest_results/harvest_results_20260213_040000.json
```

---

## 📁 File Structure

```
myai/
├── config/
│   └── sources.json              # Harvest sources configuration
├── agents/
│   ├── tech_harvester.py         # Phase 1: Scraping agent (600+ LOC)
│   └── TECH_HARVESTER_README.md  # Harvester documentation
├── tools/
│   ├── knowledge_integrator.py   # Phase 2: Refine + Integrate (700+ LOC)
│   ├── harvest_pipeline.py       # Pipeline orchestrator (500+ LOC)
│   └── HARVEST_PIPELINE_README.md # This file
└── incubator/
    └── training_data.jsonl        # Golden Dataset (instruction tuning)

temp/
└── harvest_results/
    └── harvest_results_*.json     # Harvest outputs

data/
└── brunella_lancedb/
    └── tech_trends/               # LanceDB vector storage

logs/
├── harvester.log                  # Harvest logs
├── knowledge_integrator.log       # Integration logs
└── harvest_pipeline.log           # Pipeline logs
```

---

## 🔮 Automation (Cron / Task Scheduler)

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task: "Tech-Harvester Daily"
3. Trigger: Daily at 3 AM
4. Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c cd F:\mcp-brunella-core && brunella harvest run`
5. Save

### Linux/Mac Cron

```bash
# Edit crontab
crontab -e

# Add line (run daily at 3 AM)
0 3 * * * cd /path/to/mcp-brunella-core && brunella harvest run >> logs/harvest_cron.log 2>&1
```

---

## 🐛 Troubleshooting

### Error: "playwright not installed"

```bash
pip install playwright
playwright install chromium
```

### Error: "Ollama connection failed"

```bash
# Start Ollama server
ollama serve

# Verify connection
curl http://localhost:11434/api/tags
```

### Error: "LanceDB import failed"

```bash
pip install lancedb pyarrow
```

### No items harvested

- Check `logs/harvester.log` for errors
- Verify sources in `myai/config/sources.json`
- Adjust keywords for better relevance matching

### Deduplication removes too many items

Adjust threshold in `sources.json`:

```json
{
  "refinementSettings": {
    "deduplicationThreshold": 0.90
  }
}
```

---

## 📊 Success Metrics

| Metric | Target | Achieved |
|--------|--------|----------|
| **Harvest Sources** | 5+ | 6 ✅ |
| **Items per Source** | 5 | 5 ✅ |
| **Deduplication** | < 20% loss | ~13% ✅ |
| **LanceDB Storage** | Working | ✅ |
| **Golden Dataset** | JSONL format | ✅ |
| **CLI Command** | Working | ✅ |
| **Automation** | Pipeline wrapper | ✅ |

---

## 🎯 Use Cases

### 1. Daily Tech News Aggregation

```bash
# Run daily at 3 AM (Task Scheduler / Cron)
brunella harvest run
```

**Result:** LanceDB updated with latest AI/Tech trends (searchable via RAG)

### 2. Fine-Tuning Dataset Generation

```bash
# Harvest weekly
brunella harvest run

# Check Golden Dataset
cat myai/incubator/training_data.jsonl | wc -l
```

**Result:** Growing instruction tuning dataset for LLM fine-tuning

### 3. Knowledge Base Building

```bash
# Monthly comprehensive harvest
brunella harvest run

# Query LanceDB (via RAG)
# (Future: `brunella search "latest MCP developments"`)
```

---

## 📚 References

- **Track:** `conductor/archive/TR-20260212-TECH-HAR/`
- **Harvester:** `myai/agents/tech_harvester.py`
- **Integrator:** `myai/tools/knowledge_integrator.py`
- **Pipeline:** `myai/tools/harvest_pipeline.py`
- **Config:** `myai/config/sources.json`

---

**Questions?** Check track documentation: `conductor/archive/TR-20260212-TECH-HAR/TR-20260212-TECH-HARVESTER.md`
