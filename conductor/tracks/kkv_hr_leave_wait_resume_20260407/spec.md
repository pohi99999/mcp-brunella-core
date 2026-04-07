# Specifikáció: KKV HR leave wait/resume orchestration

## Háttér
A leave approval flow jelenleg a kérelem beadását, az automatikus feldolgozást és az alap naptár/audit rögzítést lefedi. A hiányzó rész a valós manager approval wait/resume minta és a döntés visszavezetése az operatív jobba.

## Scope
- manager approval wait/resume
- decision persistence to business_jobs
- calendar reconciliation and retry
- audit trail for approve/reject
- regression tests

## Acceptance kritériumok
- A leave request nem zárul le véglegesen approval előtt.
- A manager döntés visszaíródik a job state-be.
- A naptár művelet siker/fail állapota auditban is látszik.
- Approve és reject út egyaránt tesztelve van.

## Nem része
- Onboarding
- Timesheet export
- Culture reminders
