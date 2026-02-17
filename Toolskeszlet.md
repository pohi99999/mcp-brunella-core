# 🛠️ MCP Brunella Core - Eszközkészlet (Tool Inventory)

Ez a dokumentum a szerver által biztosított MCP eszközök (tools) automatikusan generált listája.
**Generálva:** 2026. 02. 17. 17:59:09

---

## 📦 anythingllm
- **anythingllm_list_workspaces**: Lists available AnythingLLM workspaces.
- **anythingllm_chat**: Sends a chat message to an AnythingLLM workspace.

## 📦 browser
- **harvest_scenario**: Runs a Robotkéz browser automation scenario (n8n workflow creation, data extraction, etc). Calls the Python browser_worker.
- **harvest_extract**: Structured data extraction from a URL using a JSON schema (Pydantic validated).
- **browser_navigate**: Navigates to a URL and returns the page content (text/html). Handles JS.
- **browser_screenshot**: Takes a screenshot of a URL.
- **browser_action**: Autonóm böngésző vezérlés (Robotkéz CLI). Képes weboldalakat megnyitni, kattintani, gépelni és adatokat kinyerni.
- **cf_screenshot**: Capture a screenshot of a URL or raw HTML using Cloudflare Browser Rendering REST API. Supports fullPage, viewport, selector, cookies, custom JS/CSS injection.
- **cf_pdf**: Generate a PDF from a URL or raw HTML using Cloudflare Browser Rendering. Supports paper format, margins, headers/footers, landscape mode.
- **cf_content**: Fetch fully rendered HTML of a URL (after JS execution) via Cloudflare Browser Rendering. Ideal for SPAs and JS-heavy pages.
- **cf_markdown**: Extract Markdown from a webpage using Cloudflare Browser Rendering. Great for converting web content to readable Markdown.
- **cf_snapshot**: Take a full page DOM snapshot via Cloudflare Browser Rendering. Returns the accessibility tree / DOM structure.
- **cf_scrape**: Scrape HTML elements by CSS selectors via Cloudflare Browser Rendering. Returns text, HTML, attributes, and dimensions for each match.
- **cf_json**: Extract structured data from a webpage using AI (natural language prompt) via Cloudflare Browser Rendering. Ideal for data extraction without writing selectors.
- **cf_links**: Retrieve all links from a webpage via Cloudflare Browser Rendering. Returns href and text for each link.

## 📦 claudeTool
- **claude_message**: Sends a message to the Anthropic Claude API.

## 📦 copilotCliTool
- **copilot_cli**: Executes GitHub Copilot CLI commands (suggest, explain, test, fix).

## 📦 evHunterTool
- **ev_hunter_search**: Runs the Green Lightning EV Hunter - searches willhaben.at and autoscout24 for electric vehicles matching configured criteria. Returns scored results as JSON.
- **ev_hunter_status**: Returns the latest EV Hunter results from the last run (if available).

## 📦 geminiTool
- **gemini_generate**: Generate text using Google Gemini API (2.5 Pro, 2.0 Flash, etc.).

## 📦 githubModelsTool
- **github_models_generate**: Generate text using GitHub Models API (GPT-4o, DeepSeek-R1, Grok 3, etc.). Requires GitHub Pro+ subscription.

## 📦 googleWorkspace
- **gmail_list_messages**: Lists recent emails from Gmail.
- **calendar_list_events**: Lists upcoming events from Google Calendar.

## 📦 interpreter
- **interpreter_run_python**: Executes Python code in a persistent shell.

## 📦 julesCliTool
- **jules_cli**: Executes Google Jules CLI commands (run, ask, task, agent).

## 📦 knowledge
- **knowledge_search**: Searches for a text pattern (exact match).
- **knowledge_semantic_search**: Searches for meaning/concepts using RAG (Vector DB). Requires indexed files.
- **knowledge_index_file**: Adds a file to the semantic search index.
- **knowledge_read_context**: Reads multiple files to build context for LLMs.

## 📦 monitor
- **monitor_get_metrics**: Returns system metrics including uptime, memory usage, and CPU load.
- **monitor_tail_logs**: Reads the last N lines of a specified log file. log_file: name in logs/ (e.g. web_ui.log). lines: default 50.

## 📦 n8n
- **n8n_trigger_workflow**: Indít egy n8n munkafolyamatot a megadott adatokkal.

## 📦 ollamaTool
- **ollama_generate**: Generates text using a local Ollama model.

## 📦 persistentBrowserTools
- **pb_launch**: Launch a persistent browser session for interactive use.
- **pb_navigate**: Navigate to a URL in the persistent browser.
- **pb_click**: Click an element on the page.
- **pb_type**: Type text into an input field.
- **pb_screenshot**: Take a screenshot of the current page. This updates the 
- **pb_content**: Get the HTML content of the current page.
- **pb_scroll**: Scroll the page in a specified direction.
- **pb_wait**: Wait for an element to appear on the page.
- **pb_extract**: Extract data from elements on the page.
- **pb_close**: Close the persistent browser session.

## 📦 swarmTools
- **swarm_ingest**: Browse -> Refine -> Knowledge Store.

## 📦 system
- **system_run_command**: Runs a restricted system command (dir, ls, type, cat, python --version, node --version).

## 📦 workspace
- **workspace_list_directory**: Lists files and directories in the workspace.
- **workspace_read_file**: Reads the content of a file in the workspace.

## 🤖 Ágensek (Agents)
- **agent_list**: Aktív ágensek listázása.
- **agent_registry**: Minden elérhető ágens definíció.
- **agent_delegate**: Feladat delegálása egy ágensnek.

## 💻 Brunella CLI Parancsok
- **brunella conductor status**: Projekt státuszának megjelenítése.
- **brunella conductor setup**: Conductor infrastruktúra ellenőrzése.
- **brunella memory list/show/refresh**: Kontextus kezelés (mag.md).
- **brunella run <tool>**: MCP eszköz futtatása.
- **brunella chat**: Interaktív chat (Ollama).
- **brunella agents**: Ágensek listázása CLI-ből.
