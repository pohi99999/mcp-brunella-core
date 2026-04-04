# Specifikacio: Nova Multi-Agent Gatekeeper Architektura

## Hatter

A `.worktrees\\nova.zip` tartalma egy kulon Nova architekturadokumentumot tartalmaz (`script.py`, `n8n-multi-agent-nova.html`), amely a Nova Chat AI kore egy gatekeeper agentet, negy specialista sub-workflow-t, shared memory savot es emberi jovahagyasi pontokat szervez.

## Cel

Kulon trackben rogzitett architektura tervet adni a Nova hierarchikus agent-routing retegere, hogy ne mosodjon ossze a sima RAG/voice workflow-kkal.

## Scope

- Gatekeeper agent intent-elemzes es routing
- Sales, Research, Document, Execution sub-workflow-k
- Shared memory (window buffer, vector store, session context)
- Human-in-the-loop approval pontok
- Tool-pool: CRM, email, calendar, scraping, execution

## Kimenetek

- Hierarchikus multi-agent routing terv
- Sub-workflow-szintu felelossegek es adatkezeles
- Shared memory es merge strategia
- Operatori es debug kovetelmenyek

## Acceptance kriteriumok

- A gatekeeper el tudja donteni, melyik specialista workflow vagy workflow-k induljanak.
- Komplex kerdesnel tobb sub-workflow eredmenye osszefuzheto egy vegso valaszba.
- A shared memory sav egyertelmuen leirja, mi session-, es mi hosszu tavu kontextus.
- Erzekeny kulso akciok elott emberi jovahagyasi pont van.
- A tool- es debug pontok fel vannak cimkezve a tovabbi implementaciohoz.

## Nem resze ennek a tracknek

- A Nova UI vegleges HTML/CSS implementacioja.
- Barmelyik specialista workflow teljes kodszintu kivitelezese.
- Altalanos agent marketplace vagy nem Nova-specifikus router.
