# Specifikacio: P-Sales Human-in-Loop Pipeline

## Hatter

Az `.worktrees\\n8n_workflow_tervek.md` P-Sales blokkja egy ingatlanertekesitesi AI workflow-csaladot ir le, ahol a rendszer elemzi a dokumentumokat, piackutatast vegez, strategiat javasol, de a kritikus lepeseknel emberi jovahagyasra var.

## Cel

Az ertekesitesi folyamat gyorsitasa ugy, hogy a kockazatos automatikus akciok helyett emberi gate-ek maradjanak a workflow kozepen.

## Scope

- WF-PSALES-1 dokumentumfelmeres es hianylista
- WF-PSALES-2 piackutatas, ertekbecsles, wait node
- WF-PSALES-3 strategia es vegrehajtasi workflow
- WF-PSALES-4 heti audit es allapotriport
- Human-in-loop resume webhook minta

## Kimenetek

- N8n workflow-bontas emberi gate-ekkel
- Resume webhook es approvals contract
- Audit es ertesitesi schema
- Portalpublikalasi es outreach integracios pontok

## Acceptance kriteriumok

- A dokumentumfeltoltes utan hianylista strukturalt JSON-kent rendelkezik.
- A piackutatasi workflow meg tud allni jovahagyasra es kesobb ugyanonnan folytathato.
- A strategia workflow nem kuld ki kritikus akciot jovahagyas nelkul.
- A heti statusz workflow osszefoglalja az aktiv ingatlanok allapotat.
- A teljes folyamat audit-trailt general lepes, ido es eredmeny mezokkel.

## Nem resze ennek a tracknek

- Komplett portal API integracio minden piacterhez.
- Tulajdonosi kommunikacio uj UX felulete.
- Altalanos CRM ujratervezes.
