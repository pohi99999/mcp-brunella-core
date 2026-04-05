# Specifikacio: KKV CRM follow-up es routing

## Hatter
Az ingest alap utan a CRM csomag masodik fele a leadek priorizalasa, routolasa es az automatikus utanakovetes.

## Scope
- szabalyalapu lead scoring
- Slack/email routing
- D+3 / D+7 / D+14 follow-up sorozat
- cancel-on-response logika
- napi summary riport

## Acceptance kriteriumok
- A top leadek automatikus riasztast kapnak.
- A follow-up chain idozitve lefut.
- Visszajelzes eseten a pending futasok leallnak.
- Az audit log minden routing dontest tartalmaz.

## Nem resze
- CRM ingest details
- sandbox provision
- HR workflows
