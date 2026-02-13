# Tech-Harvester - Autonomous Web Scraping Agent

**Track:** TR-20260212-TECH-HAR
**Status:** Phase 1-2 COMPLETE (35%)
**Created:** 2026-02-13

---

## 🎯 Overview

Tech-Harvester is an autonomous Python agent that scrapes AI/Tech trends from configured sources (GitHub, DevTools, AI News) using Browser-Use (LangChain) + Playwright.

**Workflow:**
1. **Harvesting:** Browser automation (Playwright or Browser-Use agent)
2. **Filtering:** Keyword-based relevance detection
3. **Output:** Structured JSON results (`temp/harvest_results_{timestamp}.json`)

**Future Phases (Coming Soon):**
- Phase 3: Refiner & Integrator (LanceDB RAG integration)
- Phase 4: Automation (Cron scheduler, auto-run every 3 days)

---

## 📦 Installation

### Prerequisites

```bash
# Python 3.10+ required
python --version

# Install Playwright
pip install playwright
playwright install chromium

# Optional: Install Browser-Use (for intelligent agent mode)
pip install browser-use langchain-ollama
```

### Verify Installation

```bash
cd myai
python agents/tech_harvester.py --help
```

---

## 🚀 Usage

### Basic Usage (Playwright Mode - Recommended)

```bash
cd myai
python agents/tech_harvester.py --mode playwright
```

**Output:**
```
==================================================
   TECH-HARVESTER STARTING
==================================================
Mode: playwright
Sources: 6 enabled
==================================================

Processing source: GitHub Trending AI
URL: https://github.com/trending/python?since=daily
[OK] Playwright extracted 5 items from GitHub Trending AI

...

==================================================
TECH-HARVESTER COMPLETED
Total items: 23
Duration: 45.23 seconds
Output: temp/harvest_results/harvest_results_20260213_024530.json
==================================================
```

### Intelligent Mode (Browser-Use Agent)

**Requires:** `browser-use` + `langchain-ollama` + Ollama running

```bash
# Start Ollama (in separate terminal)
ollama serve

# Run harvester with Browser-Use
python agents/tech_harvester.py --mode browser-use
```

### Custom Config

```bash
python agents/tech_harvester.py --config path/to/custom_sources.json
```

### Debug Mode

```bash
python agents/tech_harvester.py --log-level DEBUG
```

---

## ⚙️ Configuration

**File:** `myai/config/sources.json`

### Example Source

```json
{
  "name": "GitHub Trending AI",
  "url": "https://github.com/trending/python?since=daily",
  "type": "list",
  "enabled": true,
  "selector": "article.Box-row",
  "extractFields": ["title", "description", "stars", "url"],
  "keywords": ["MCP", "Agent", "Orchestrator", "RAG"]
}
```

### Settings

```json
{
  "harvesterSettings": {
    "maxItemsPerSource": 5,
    "timeoutSeconds": 60,
    "headless": true,
    "screenshotOnError": true
  }
}
```

---

## 📊 Output Format

**File:** `temp/harvest_results/harvest_results_{timestamp}.json`

```json
{
  "harvested_at": "2026-02-13T02:45:30.123Z",
  "config_version": "1.0.0",
  "total_items": 23,
  "sources": ["GitHub Trending AI", "Vercel AI SDK Docs", ...],
  "items": [
    {
      "source": "GitHub Trending AI",
      "url": "https://github.com/trending/python",
      "content": "Project description...",
      "timestamp": "2026-02-13T02:45:30.123Z",
      "type": "list"
    }
  ]
}
```

---

## 📋 Configured Sources (6)

| Source | URL | Type | Keywords |
|--------|-----|------|----------|
| GitHub Trending AI | github.com/trending/python | list | MCP, Agent, RAG |
| GitHub MCP Servers | github.com/modelcontextprotocol/servers | docs | MCP, Server |
| Vercel AI SDK Docs | sdk.vercel.ai/docs | docs | AI SDK, Agent |
| LangChain Blog | blog.langchain.dev | article | Agent, LangGraph |
| Anthropic Docs | docs.anthropic.com | docs | Claude, Tool Use |
| HuggingFace Papers | huggingface.co/papers | list | LLM, Fine-tuning |

**Note:** Anthropic Docs currently disabled (`enabled: false`) to reduce load.

---

## 🧪 Testing

### Test Run (5 items per source)

```bash
python agents/tech_harvester.py --mode playwright
```

**Expected Output:**
- Logs: `logs/harvester.log`
- Results: `temp/harvest_results/harvest_results_*.json`
- ~20-30 items collected (5 per enabled source)

### Verify Results

```bash
# Check output directory
ls temp/harvest_results/

# View latest results (PowerShell)
cat (ls temp/harvest_results/ | sort -desc | select -first 1).FullName | python -m json.tool
```

---

## 🐛 Troubleshooting

### Error: "playwright not installed"

```bash
pip install playwright
playwright install chromium
```

### Error: "No module named 'browser_use'"

Browser-Use is optional. Use Playwright mode:

```bash
python agents/tech_harvester.py --mode playwright
```

Or install Browser-Use:

```bash
pip install browser-use langchain-ollama
```

### Error: "timeout exceeded"

Increase timeout in `sources.json`:

```json
{
  "harvesterSettings": {
    "timeoutSeconds": 120
  }
}
```

### No items collected

Check keywords relevance. Adjust in `sources.json`:

```json
{
  "globalKeywords": ["Your", "Custom", "Keywords"]
}
```

---

## 📝 Logs

**Location:** `logs/harvester.log`

**Format:**
```
2026-02-13 02:45:30 [INFO] [TechHarvester] TechHarvester initialized with 6 enabled sources
2026-02-13 02:45:31 [INFO] [TechHarvester] Starting Playwright browser (headless=True)
2026-02-13 02:45:35 [INFO] [TechHarvester] Page loaded: https://github.com/trending/python
2026-02-13 02:45:38 [INFO] [TechHarvester] [OK] Playwright extracted 5 items from GitHub Trending AI
```

---

## 🔮 Next Steps (Phase 3-4)

**Phase 3: Refiner & Integrator**
- LLM-based content summarization
- LanceDB vector storage (RAG)
- Deduplication

**Phase 4: Automation**
- Cron scheduler (every 3 days)
- CLI command: `brunella harvest`
- Dashboard widget: "Last Knowledge Update"

---

## 🛡️ Security

- Headless mode enabled (no visible browser)
- Screenshot on error (debugging)
- No credentials required (public sources)
- Rate limiting (max 5 items per source)

---

## 📚 References

- **Track:** `conductor/tracks/TR-20260212-TECH-HAR/`
- **Config:** `myai/config/sources.json`
- **Script:** `myai/agents/tech_harvester.py`
- **Logs:** `logs/harvester.log`
- **Output:** `temp/harvest_results/`

---

**Questions?** Check `conductor/tracks/TR-20260212-TECH-HAR/TR-20260212-TECH-HARVESTER.md`
