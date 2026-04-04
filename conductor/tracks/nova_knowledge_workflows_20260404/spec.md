# Specifikacio: Nova Tudasbazis es Interakcios Workflow-k

## Hatter

Az `.worktrees\\n8n_workflow_tervek.md` Nova resze egy olyan cegspecifikus AI asszisztenst ir le, amely dokumentumokat ingestal, RAG alapon valaszol, hangon kommunikál, napi briefinget kuld, es frissiti a cegprofilt.

## Cel

Nova workflow-szintu kepessegeinek trackelesre alkalmas strukturalasa, kulon a tudastar, chat, voice es proaktiv funkcionalitas menten.

## Scope

- WF-NOVA-1 document ingestion
- WF-NOVA-2 chat + RAG
- WF-NOVA-3 hangalapu interakcio
- WF-NOVA-4 proaktiv napi osszefoglalo
- WF-NOVA-5 cegprofil tanulas es frissites

## Kimenetek

- N8n workflow-terv az 5 Nova folyamatra
- Vector store es metadata kovetelmenyek
- Session memory es tool-hivas contract
- Adatfrissitesi es operatori biztonsagi szabalyok

## Acceptance kriteriumok

- Dokumentum ingest utan a rendszer metadatazott chunkokat tarol vector store-ban.
- A chat workflow top-k kontextust tud bevonni es magyar valaszt ad.
- A voice workflow szoveges es audio kimenetet is elo tud allitani.
- A napi briefing feladatokat es naptaradatokat osszegez.
- A cegprofil csak tenyszeru, stabil adatokkal frissul.

## Nem resze ennek a tracknek

- A Nova frontend teljes ujradesignja.
- Saját embedding modell fejlesztese.
- Nem cegspecifikus altalanos publikus chatbot platform.
