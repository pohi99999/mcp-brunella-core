TASK: Create the "Brunella Enterprise Suite" Automation Library.

CONTEXT:
We are building a business automation layer for the Brunella Agent System (BAS). We need 10 specific workflow templates for n8n and Langflow.

ACTION PLAN:

1. Create a new directory: src/workflows/enterprise\_suite/
2. Inside, create 3 subfolders: 01\_cash\_flow, 02\_visibility, 03\_control.
3. For EACH of the 10 workflows listed below, create a dedicated folder (e.g., 01\_cash\_flow/01\_smart\_invoice/) containing:

   * workflow.json: A valid JSON structure importable into n8n or Langflow.
   * README.md: A short guide (setup, API keys).
   * prompts.ts: System prompts for AI nodes in HUNGARIAN.

THE 10 WORKFLOWS:

\[N8N - Operational]

1. Smart Invoice Processing (Email trigger -> OCR -> Sheets)
2. Lead Hunter (Form trigger -> Enrichment API -> Scoring -> Slack)
3. Client Onboarding (Webhook -> Drive Folder -> Email)
4. Content Repurposing (YouTube -> Whisper -> Gemini Blog/Social -> Trello)
5. Meeting Secretary (File upload -> Transcribe -> Summarize -> Email)

\[LANGFLOW - Cognitive]
6. RFP Writer (RAG over 'past\_projects' -> Generate Proposal)
7. Competitor Spy (Web Scrape -> SWOT Analysis)
8. Legal Auditor (PDF Upload -> Risk Analysis against 'safety\_rules')
9. Level 2 Support (Chat Input -> RAG Search -> Draft Answer)
10. Chief of Staff (Data Aggregation -> Executive Summary)

REQUIREMENTS:

* Use "Gemini Pro" as the model in all JSON templates.
* Ensure all system prompts in prompts.ts are in HUNGARIAN.
* Create a manifest.json in the root listing all workflows.
