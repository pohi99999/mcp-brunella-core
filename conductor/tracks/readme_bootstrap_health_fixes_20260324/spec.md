# Spec — README Bootstrap & Health Fixek

## Cél
A README-ben előírt bootstrap és validációs lépések után talált hibák javítása úgy, hogy a fejlesztői induló folyamat megbízhatóbb legyen, és a health/smoke zajmentesebb, pontosabb visszajelzést adjon.

## Scope
- smoke script ne akarjon új webszervert indítani alapértelmezetten
- opcionális GitHub webhook konfiguráció hiánya ne jelenjen meg startup hard error-ként
- `src/agents/registry.json` numerikus `version` mezője legyen kompatibilis a validációval
- Python health check használja a standard `/health` végpontot

## Nem cél
- `.env` szerkesztése
- új üzleti funkció hozzáadása
- teljes production deploy