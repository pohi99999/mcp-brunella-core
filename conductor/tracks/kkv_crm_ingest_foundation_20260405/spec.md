# Specifikacio: KKV CRM ingest alapok

## Hatter
A CRM csomag elso koherens szelete a lead bejovo csatornainak egysegesitese. Ide tartozik a webhook vagy email ingest, a canonical lead modell, a deduplikacio es az elso CRM sandbox iras.

## Scope
- WF-CRM-1 lead webhook vagy email trigger
- canonical transform
- dedupe email/phone/hash alapon
- temp vagy kis persistent buffer
- HubSpot sandbox vagy stub push

## Acceptance kriteriumok
- Egy mintalead normalizalva kerul be a pipeline-ba.
- A dedupe kezeli az ismetlodo email vagy phone rekordokat.
- Legalabb egy CRM sandbox write ut nyitva van vagy stubbal igazolva.
- A transform logic helyi teszttel futtathato.

## Nem resze
- Scoring
- Follow-up sorozat
- Human-in-loop approval
- Dashboard reporting
