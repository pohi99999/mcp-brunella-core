# ADR 0001: Living Documentation System bevezetése

- **Status:** accepted
- **Date:** 2026-02-13

## Context

Az API, agent és működési dokumentáció több helyre szóródott. Ez lassította az onboardingot és növelte a támogatási terhelést.

## Decision

Living Documentation rendszert vezetünk be az alábbi elemekkel:

1. Agentenként külön dokumentáció (`docs/agents/*.md`) és coverage riport.
2. Swagger/OpenAPI központi belépési pont (`/api-docs`).
3. Külön `ADR/` döntésnapló mappa.
4. Interaktív Jupyter példák a `myai/examples/` alatt.

## Consequences

### Pozitív

- Gyorsabb tudásátadás.
- Könnyebb architekturális visszakövethetőség.
- Kevesebb ad-hoc tudásvesztés.

### Trade-off

- Folyamatos dokumentáció-karbantartást igényel.
