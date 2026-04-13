# InventoryFifoAgent

**Agent Name:** `InventoryFifoAgent`
**Source:** `src/agents/InventoryFifoAgent.ts`
**Role:** Készletkezelő — FIFO értékelés

## Description

FIFO alapú készletbevételezés, kiadás és ELÁBÉ kalkuláció KKV-k számára.

## Capabilities

- `fifo_receive`
- `fifo_issue`
- `cogs_calculation`
- `inventory_status`

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
