# Specifikáció: KKV HR timesheet export és culture alerts

## Háttér
A jelenlegi timesheet flow a validált bejegyzések feldolgozását lefedi, de hiányzik a havi payroll export és a napi HR culture reminder réteg.

## Scope
- monthly timesheet export
- Sheets vagy CSV output
- birthday / anniversary alerts
- daily scheduler
- duplicate suppression and auditability

## Acceptance kritériumok
- A havi export payroll-ready formátumban készül.
- A napi scheduler megbízhatóan fut és nem duplikál.
- Az export és az alert auditban visszakereshető.
- A flow restart után is idempotens marad.

## Nem része
- Onboarding
- Leave approvals
- CRM workflow-k
