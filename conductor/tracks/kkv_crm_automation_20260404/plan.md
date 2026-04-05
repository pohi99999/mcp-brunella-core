# KKV CRM Automation (Track: kkv_crm_automation_20260404)

## Goal
Bootstrap the KKV CRM automation feature by adding skeletons for route, service, tool, agent and unit tests so further implementation and integration can proceed safely.

## Steps
1. Create a feature branch:
   ```bash
   git checkout -b feature/kkv-crm-skeleton-20260404
   ```
2. Add the skeleton files (routes, service, tool, agent) and unit test.
3. Build & run unit tests locally:
   ```bash
   npm run build
   npm run test:fast
   ```
4. Push branch and open PR for review.

## PR checklist (short)
- [ ] Branch created and pushed
- [ ] `npm run build` passes locally
- [ ] Unit tests pass (`npm run test:fast`)
- [ ] PR description includes next steps and reviewers

## Next steps after merge
- Implement persistence (DB) + input validation
- Wire real CRM provider integration (API client, credentials)
- Add integration/e2e tests and dashboard/CLI surfaces
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
