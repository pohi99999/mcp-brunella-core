# Agent Architect 2.0 - Meta-Ügynök Upgrade

## Összefoglaló
Az Agent Architect a rendszer "reproduktív motorja" - lehetővé teszi új ügynökök automatikus generálását természetes nyelvű leírásból.

## Jelenlegi Állapot
- ✅ Alap implementáció létezik (`registry.json`-ban)
- ✅ Szerepkör és capabilities definiálva
- ❌ TOML generálás nincs automatizálva
- ❌ DynamicAgent loader hiányzik
- ❌ Test suite generálás hiányzik

## Cél Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT FACTORY                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: "Készíts ügynököt ami tőzsdét figyel"               │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────┐             │
│  │           AGENT ARCHITECT                   │             │
│  ├────────────────────────────────────────────┤             │
│  │ 1. Tech Decision (Node.js vs Python)       │             │
│  │ 2. Prompt Engineering (Role/Goal/Format)   │             │
│  │ 3. Dependency Detection                    │             │
│  │ 4. TOML Config Generation                  │             │
│  │ 5. Test Suite Generation                   │             │
│  └────────────────────────────────────────────┘             │
│                            │                                 │
│                            ▼                                 │
│  Output:                                                     │
│  ├── myai/agents/stock_watcher.toml                         │
│  ├── myai/agents/stock_watcher.py                           │
│  ├── test/stock_watcher.test.ts                             │
│  └── Registry entry (auto-registered)                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 5 Lépéses Protokoll

### 1. Technológiai Döntés
```typescript
interface TechDecision {
  runtime: 'nodejs' | 'python';
  reason: string;
  location: 'src/agents/' | 'myai/agents/';
}
```

**Szabályok:**
- Adatfeldolgozás, ML → Python
- IO műveletek, API hívások → Node.js
- Böngésző automatizálás → Python (Playwright)

### 2. Prompt Engineering
**Struktúra minden új ügynöknek:**
```yaml
Role: <egyértelmű szerep>
Objective: <konkrét cél>
Constraints: <limitációk>
Output Format: <elvárt kimenet>
Chain of Thought: <gondolatmenet lépések>
```

### 3. Függőség Detektálás
Automatikus package detection:
```python
# Kulcsszavak → packagek mapping
DEPENDENCY_MAP = {
    "tőzsde": ["yfinance", "pandas"],
    "web scraping": ["playwright", "beautifulsoup4"],
    "api": ["httpx", "aiohttp"],
    "database": ["sqlalchemy", "lancedb"],
}
```

### 4. TOML Konfiguráció
```toml
[agent]
name = "stock_watcher"
title = "Stock Watcher Agent"
runtime = "python"
version = "1.0.0"

[agent.prompt]
system = """
Role: Tőzsdei Elemző
Objective: Valós idejű árfolyam monitoring
...
"""

[agent.capabilities]
skills = ["market_analysis", "alert_generation"]
tools = ["system_run_command", "knowledge_search"]

[agent.dependencies]
python = ["yfinance>=0.2.0", "pandas>=2.0.0"]
```

### 5. DynamicAgent Loader
**Fájl:** `src/agents/DynamicAgentLoader.ts`

```typescript
class DynamicAgentLoader {
  async loadFromTOML(path: string): Promise<IAgent> {
    const config = toml.parse(await fs.readFile(path));
    return new DynamicAgent(config);
  }

  async loadAllAgents(dir: string): Promise<IAgent[]> {
    const files = await glob(`${dir}/*.toml`);
    return Promise.all(files.map(f => this.loadFromTOML(f)));
  }
}
```

## Mérföldkövek

- [ ] TOML parser integráció (`@iarna/toml`)
- [ ] `DynamicAgentLoader.ts` implementálás
- [ ] Agent Architect prompt finomhangolás
- [ ] Dependency detection logika
- [ ] Test template generálás
- [ ] CLI parancs: `brunella architect create <description>`
- [ ] Hot-reload: új ügynök újraindítás nélkül

## Példa Használat

```bash
# CLI-ből
brunella architect create "Készíts ügynököt ami figyeli a HackerNews top posztokat és összefoglalja őket"

# Eredmény:
# ✅ Created: myai/agents/hackernews_watcher.toml
# ✅ Created: myai/agents/hackernews_watcher.py
# ✅ Created: test/hackernews_watcher.test.ts
# ✅ Registered in registry.json
#
# Run: brunella run hackernews_watcher "Get today's top 10"
```

## Kockázatok

1. **LLM hallucination:** Nem létező package-eket generálhat
2. **Security:** Generált kód review szükséges
3. **Naming conflicts:** Létező ügynök neve

## Kapcsolódó Trackek
- `data_flywheel_incubator` - Training data source
- `spec_freeze_protocol` - Spec validáció
