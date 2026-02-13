# ADR 0002: Embedding standard = mxbai-embed-large + legacy fallback

- **Status:** accepted
- **Date:** 2026-02-13

## Context

A RAG komponensben eltérő embedding modellek használata és API-költségkitettség jelent meg. Cél a lokális, privacy-barát, költséghatékony egységesítés.

## Decision

1. Primer embedding modell: `mxbai-embed-large` (Ollama, lokális).
2. Legacy kompatibilitás: `nomic-embed-text` fallback index megtartása.
3. Keresésnél primer index előnyben részesítése, üres/hibás esetben fallback.

## Consequences

### Pozitív

- API költségcsökkentés.
- Adatlokalitás és privacy javulás.
- Zökkenőmentes migráció dual-index stratégiával.

### Trade-off

- Ideiglenesen dupla index karbantartás.
