# Specifikacio: KKV CRM Automatizalas

## Hatter

A CRM blokk két koherens szálra bontható:

1. **CRM Ingest Foundation** — webhook/email ingest, canonical transform, dedupe, CRM write, basic ack.
2. **CRM Follow-up + Routing** — scoring, Slack/email routing, D+3 / D+7 / D+14 follow-up, cancel-on-response, human approval, reporting.

A jelenlegi repo már az 1. szálat fedi le; a 2. szál külön trackként folytatandó.

## Scope

- WF-CRM-1 bejovo lead feldolgozas
- WF-CRM-2 ugyfel utanakovetes es follow-up sorozat
- Gmail, Slack es CRM adattar integraciok
- AI priorizalas es belso SLA figyeles

## Szetszedett trackek

- `kkv_crm_ingest_foundation_20260405` — kész
- `kkv_crm_followup_approval_reporting_20260405` — lezárt approval/reporting slice

## Acceptance kriteriumok

- Minden lead egyetlen adatmodellbe kerul be.
- AI prioritas es belso riasztas a lead bejovetelekor letrejon.
- Follow-up utemezes D+3 / D+7 / D+14 mintaval mukodik.
- Ugyfelvalasz eseten a pending utemezesek leallnak.

## Rollout

- Operativ alap track; a foundation kész, a follow-up/routing külön trackként megy tovább.
