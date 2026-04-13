# InventoryWacAgent

**Agent Name:** `InventoryWacAgent`
**Source:** `src/agents/InventoryWacAgent.ts`
**Role:** Készletkezelő — WAC (Súlyozott Átlagár) értékelés

## Description

Napi WAC ár frissítés és WAC alapú készletkiadás KKV-k számára. Számvitelileg helyes, minden bevételezés után azaynnali WAC újraszámítás.

## Capabilities

- `wac_refresh`
- `wac_issue`
- `wac_recalculate`

## Inputs / Outputs

- **Primary input:** Task string + optional context object.
- **Primary output:** Agent result/response object.

## Operational Notes

- Generated automatically by `ProjectConductorAgent` during `conductor sync`.
- Replace placeholders and expand with concrete examples over time.

## TODO

- [ ] Add real-world usage examples
- [ ] Add failure modes and recovery notes
- [ ] Add integration touchpoints
