# Implementacios Terv: VIKTORIAVARGA brand voice foundation

## Cel
A VIKTORIAVARGA márkahang stabil, TOML-alapú DynamicAgent formába rendezése, hogy minden későbbi brand copy ugyanarra a voice layerre épüljön.

## Lepesek
1. Brand voice prompt és input schema véglegesítése.
2. DynamicAgent registry bekötés és trigger routing.
3. Fókuszált teszt a TOML betöltésére és a voice guardrail-ekre.
4. Rövid validáció branded caption / email / product copy mintákkal.

## Kimenet
- `myai/agents/ViktoriaBrandVoice.toml`
- `src/agents/registry.json`
- `test/viktoriaBrandVoiceAgent.test.ts`

## Definition of done
- A brand voice agent külön, brand-specifikus identitással tölthető be.
- A tiltott szavak a promptban explicit szerepelnek.
- A TOML + registry + test együtt zöld.
