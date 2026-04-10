# Brunella–AnythingLLM Desktop Integration

## Használat

1. Indítsd el a Brunella backendet.
2. Nyisd meg az AnythingLLM Desktopot.
3. Küldd a `X-Brunella-Secret` headert, és opcionálisan a `X-Brunella-Role` szerepkört (`operator` vagy `admin`).
4. Használd a custom action gombokat.
5. A felület kér → Brunella hajt végre → UI visszajelez.

## Approval / RBAC flow

- Low-risk actionök (`email_triage`, `calendar_check`, `document_summary`) `operator` szerepkörrel futtathatók.
- High-risk actionök (`browser_task`, `agent_start`) csak `admin` szerepkörrel indíthatók.
- High-risk action első hívásra `202 approvalRequired=true` választ ad, benne `approvalId`-val.
- A jóváhagyás a meglévő approval endpointokon / dashboard approval felületen történik.
- Jóváhagyás után ugyanaz az action újrahívható az `approvalId`-val.

## Támogatott műveletek

- "Email feldolgozás" → InvoiceAutomation agent
- "Naptár ellenőrzés" → Calendar workflow
- "Dokumentum összefoglaló" → RAG + ResearcherAgent
- "Böngésző feladat" → RobotkezV2
- "Agent indítás" → AgentManager

## Szabályok

- Kritikus műveletekhez UI jóváhagyás kell.
- Minden logolva van.
- A Brunella marad a fő kontrollpont.
