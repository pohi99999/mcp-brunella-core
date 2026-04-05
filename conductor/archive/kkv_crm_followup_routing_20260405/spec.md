# Specifikacio: KKV CRM follow-up es routing

## Hatter
Az ingest foundation utan a CRM csomag masodik, kulon kezelt szala a leadek priorizalasa, routolasa es az automatikus utanakovetes.

## Scope
- szabalyalapu lead scoring
- Slack/email routing
- D+3 / D+7 / D+14 follow-up sorozat
- cancel-on-response logika
- napi summary riport
- human-in-loop approval
- audit log minden donteshez

Megjegyzes: a routing/scheduler slice most már elkészült; a human approval + daily summary külön trackbe került.

## Acceptance kriteriumok
- A top leadek automatikus riasztast kapnak.
- A follow-up chain idozitve lefut.
- Visszajelzes eseten a pending futasok leallnak.
- Az audit log minden routing dontest tartalmaz.
- A human approval tud engedelyezni vagy leallitani egy follow-up akciot.

## Első implementacios lepések

1. scoring + routing decision
2. D+3 / D+7 / D+14 scheduler
3. cancel-on-response hook
4. human approval + audit log
5. daily summary

## Nem resze
- CRM ingest details
- sandbox provision
- HR workflows
