# Spec — Brunella–AnythingLLM Desktop Integration

## Cél

AnythingLLM Desktop = kényelmi cockpit. Brunella = döntés és végrehajtás.

## Probléma

Nincs egységes, kényelmes UI a napi Brunella műveletekhez.

## Célállapot

- UI indít feladatokat.
- Brunella API kezeli.
- Agentek/toolok hajtják végre.
- Biztonság megmarad.

## Képességek

- Email triage
- Naptárkezelés
- Dokumentum rendszerezés
- Browser feladatok
- Fájlkezelés
- Agent vezérlés

## Szabályok

- Nincs direkt OS hozzáférés UI-ból
- Minden auditált
- RBAC aktív
- Approval kritikus műveletekre

## Architektúra

UI → Brunella API → AgentManager → Tool/MCP → Végrehajtás
