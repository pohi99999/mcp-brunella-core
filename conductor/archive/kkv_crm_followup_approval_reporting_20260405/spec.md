# Specifikacio: KKV CRM follow-up approval es reporting

## Hatter
A scoring + routing + scheduler slice el van valasztva a külön approval/reporting fokozattol.

## Scope
- human-in-loop approval a kiemelt follow-up akciokra
- napi summary riport
- audit log minden manualis donteshez
- approval callback / pause / resume

## Acceptance kriteriumok
- Az approval le tud állítani vagy engedélyezni egy follow-up akciót.
- A napi summary tartalmazza az aktív, késleltetett és leállított szálakat.
- Minden manuális döntés auditált.

## Első implementacios lepések
1. approval control surface
2. daily summary aggregation
3. audit log wiring

## Nem resze
- ingest
- scoring
- D+3 / D+7 / D+14 scheduler
