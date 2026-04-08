# Specifikacio: VIKTORIAVARGA brand voice foundation

## Hatter
A VIKTORIAVARGA márka hangja külön kezelést igényel: prémium fashion tone, érzelmes, direkt, HU+EN működés és szigorú brand guardrail-ek kellenek.

## Scope
- TOML-backed DynamicAgent.
- Caption, email, campaign copy és product description generálás.
- Bilingual copy generation és tone guardrail-ek.

## Outside scope
- Stratégiai kampánytervezés.
- Vizuális arculattervezés.
- Ár- és promóciós döntések.

## Implementacios celpontok
- `myai/agents/ViktoriaBrandVoice.toml`
- `src/agents/registry.json`
- `test/viktoriaBrandVoiceAgent.test.ts`

## Acceptance kriteriumok
- A DynamicAgent TOML-ból tölti be a márkahangot.
- A tilos szavak nem kerülnek a prompt logikába.
- A registry trigger alapján route-olható a márka kérés.

## Rollout
1. Voice prompt és input schema.
2. Registry bekötés.
3. TOML loading teszt.
4. Branded sample copy review.
