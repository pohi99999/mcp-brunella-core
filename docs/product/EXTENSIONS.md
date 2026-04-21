# Brunella Extensions and Integrations

This document summarizes the external integrations, MCP tools, and automation surfaces of the Brunella Agent System.

---

## 1. MCP and Tool Integration Matrix

Brunella is an MCP-compatible system where tools and agents are accessible through standard MCP servers, REST/CLI bridges, and dashboard interfaces.

### Tool Families

| Tool Family | Files | Main Functions |
|---|---|---|
| Workspace | `workspace.ts`, `unifiedWorkspace.ts` | file read, write, search, workspace operations |
| Knowledge | `knowledge.ts`, `memoryTool.ts` | RAG search, memory management |
| System | `system.ts`, `monitor.ts`, `deploymentAnalyzer.ts` | system status, diagnostics, deployment analysis |
| Browser | `browser.ts`, `persistentBrowserTools.ts`, `browserBridge.ts` | web interaction, sessions, browser bridge |
| LLM provider tools | `ollamaTool.ts`, `geminiTool.ts`, `githubModelsTool.ts`, `claudeTool.ts` | multi-provider AI calls |
| CLI bridges | `copilotCliTool.ts`, `julesCliTool.ts` | external CLI integration |
| Swarm | `swarmTools.ts`, `negotiationEngine.ts` | colony voting, coordination |
| External automation | `n8n.ts`, `anythingllm.ts`, `crawl4aiTool.ts`, `evHunterTool.ts` | workflow and service integrations |
| Business/invoice | `getSzamlazzInvoices.ts`, `writeSheetsInvoices.ts`, `getAiRecommendation.ts` | invoice, Sheets, recommendation |
| Google Workspace | `googleWorkspace.ts`, `unifiedGoogleWorkspaceTool.ts` | Gmail, Drive, Sheets, Calendar integrations |

---

## 2. External Integrations and Automation Surfaces

### Documented Integrations

| Integration | Function |
|---|---|
| Google Workspace | Gmail, Sheets, Drive, Calendar workflows |
| Számlázz.hu | invoice reading and processing |
| n8n | workflow automation |
| AnythingLLM | external knowledge/chat surface |
| Apify | deep scraping |
| Jules | test / automation / CI-style orchestration |
| Cloudflare | edge, workers, D1, tunnel |
| Chrome ACP / DevTools | browser debug automation |
| code-server | remote IDE interface |
| Tauri | desktop shell |
| Playwright | browser automation |
| LanceDB / ChromaDB | vector knowledge |
| E2B | sandbox execution |
| Nodemailer / Google APIs | communication/workspace capabilities |

### Sales and Outreach Capabilities

The repository contains several sales/marketing focused subsystems:
- lead mining,
- EV hunter,
- trojan horse campaign,
- campaign studio,
- innovation bridge,
- market watcher,
- grants and tender monitoring,
- invoice sync and business analytics.
