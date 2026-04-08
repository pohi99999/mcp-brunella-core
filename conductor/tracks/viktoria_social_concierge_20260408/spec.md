# Specifikacio: VIKTORIAVARGA social concierge

## Hatter
A social felületeken gyors, de prémium hangú válaszok kellenek. A concierge réteg a brand voice foundationből dolgozik, és egységesíti a post, reply és DM draftokat.

## Scope
- Instagram / social post draft.
- Reply and DM draft generation.
- Community-friendly, premium tone.

## Outside scope
- Paid media buying.
- Visual content production.
- Customer support ticketing beyond draft szint.

## Implementacios celpontok
- `src/agents/registry.json`
- `src/agents/MarketingDirectorAgent.ts`
- `src/agents/CopywriterAgent.toml` mintázatkövetés
- jövőbeli social concierge agent config

## Acceptance kriteriumok
- A brand voice mindig elsődleges.
- A social válaszok csatorna-kompatibilisek.
- A kivételes eseteknél rövid clarification fallback van.

## Rollout
1. Brand voice inherit.
2. Social copy draft patterns.
3. Reply/DM guardrails.
4. Review and tuning.
