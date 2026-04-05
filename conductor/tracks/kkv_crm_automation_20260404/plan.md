# Implementacios Terv: KKV CRM Automatizalas

## Fazisok

### 1. Lead bejovo csatornak
- WF-CRM-1 lead webhook vagy email trigger feldolgozas.
- AI klasszifikacio, CRM rogzites es automata visszaigazolas.
- Delivered: ingest foundation track lezárva.

### 2. Follow-up motor
- WF-CRM-2 ajanlat utani utemezett utanakovetes.
- Cancel-on-response szabaly es ertekesitoi atvetel.
- Separate track: `kkv_crm_followup_approval_reporting_20260405` (archived)

### 3. Priorizalas es SLA
- Belső ertesitok, hataridos emlekeztetok es feldolgozasi SLA-k.

### 4. Validacio
- Lead->CRM->ertesites es follow-up sorozat vegeigfutas.

## Szetszedesi döntés

- A CRM monolit nem marad egyben.
- Az ingest foundation külön, lezárt track.
- Az approval/reporting follow-up slice elkészült és archíválva lett; a fennmaradó CRM munka más aktív trackekbe kerülhet.
