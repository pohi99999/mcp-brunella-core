# SafetyStockAgent

**Agent Name:** `SafetyStockAgent`
**Source:** `src/agents/SafetyStockAgent.ts`
**Role:** Biztonsági készlet kalkulátor

## Description

Statisztikai módszerrel kiszámítja a biztonsági készlet szintjét és az újrarendelési pontot minden termékhez. Képlet: Z × σ × √(lead_time). DB-be visszaírja az eredményt.

## Capabilities

- `safety_stock_calculation`
- `reorder_point_calculation`
- `demand_variability_analysis`

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
