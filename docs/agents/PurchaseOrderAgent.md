# PurchaseOrderAgent

**Agent Name:** `PurchaseOrderAgent`
**Source:** `src/agents/PurchaseOrderAgent.ts`
**Role:** Autonóm beszerzési rendelés generáló

## Description

Automatikusan azonosítja a készlethiányos termékeket (current_stock ≤ reorder_point), LLM-mel professzionális magyar megrendelő levelet állít elő és PENDING_APPROVAL PO-t hoz létre emberi jóváhagyásra.

## Capabilities

- `purchase_order_generation`
- `reorder_detection`
- `supplier_email_draft`
- `human_in_the_loop`

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
