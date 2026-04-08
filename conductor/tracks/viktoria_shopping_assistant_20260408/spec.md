# Specifikacio: VIKTORIAVARGA shopping assistant

## Hatter
A shopping asszisztens a márka hangját customer-service feladathoz igazítja: termékhez, elérhetőséghez, rendeléshez és alap support kérdésekhez.

## Scope
- Product discovery drafts.
- Order and availability replies.
- Support-safe, premium tone.

## Outside scope
- Fizetési feldolgozás.
- Raktár- vagy ERP írós műveletek.
- Automatikus refund döntések.

## Implementacios celpontok
- `src/agents/CustomerService*`
- `src/agents/registry.json`
- `src/agents/CopywriterAgent.toml`
- jövőbeli shopping assistant routing

## Acceptance kriteriumok
- A brand voice öröklődik.
- A service válaszok rövidek és tiszták.
- Az eszkalációs fallback működik.

## Rollout
1. Intent classification.
2. Brand-safe response drafting.
3. Handoff policy.
4. QA and tuning.
