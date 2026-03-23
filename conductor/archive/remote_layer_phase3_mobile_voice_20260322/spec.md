# Spec: Brunella Remote Layer — Fázis 3: Mobile, Voice & Deep PAIOS Integration

## Track ID

`remote_layer_phase3_mobile_voice_20260322`

## Forrás

- `f:\mcp-brunella-core\.worktrees\Brunella_superinnteligencia.md`
- Megjegyzés: a Fázis 3 teljes promptja nem szerepel kifejtve a dokumentumban.
- Rekonstrukciós alap: a Fázis 4 előfeltétel-listája (`Mobil UI`, `Remote Files + Voice Interface`, `Unified EventBridge`, `PAIOS High-Level Actions + Deep Integration`, `Dashboard ... + Flows`).

## Cél

1. A remote réteg kapjon első osztályú mobil- és hanginterfészt.
2. A PAIOS integráció mélyüljön el eseményhíddal és magasabb szintű context-szinkronnal.
3. Jöjjön létre egy olyan bridging fázis, amely logikusan összeköti a discovery/auth réteget a későbbi distributed mesh világgal.

## Scope

- mobil kliens skeleton / Expo vagy React Native adapter
- voice input / speech-to-command kezelési alapok
- `UnifiedEventBridge` vagy ekvivalens eseménybusz a remote réteghez
- remote file access és streamelhető események
- PAIOS deep integration a remote session és action API fölött
- dashboard flow / mobile-facing állapotnézetek első iterációja

## Kimenetek

- Mobil kliens bootstrap remote session és command támogatással
- Voice input pipeline első integrációja
- Eseményhíd agent / tool / device eseményekhez
- Remote fájlműveleti interfész a sessionökön keresztül
- PAIOS mélyebb session- és stream-integráció

## Nem része ennek a fázisnak

- Distributed mesh és edge routing
- Teljes offline CRDT sync
- Agent federation és globális state replikáció

## Elfogadási kritériumok

- A mobil kliens képes remote sessiont nyitni és commandot küldeni.
- A voice input legalább egy command típusra átfordítható a remote API számára.
- Az eseményhíd képes agent és remote rendszereseményeket továbbítani.
- A PAIOS kliens mélyebb integrációja dokumentált és minimálisan működőképes.
- A dashboardon megjelenik a mobile/flow orientált állapotnézet első verziója.
- `npm run build` sikeres.
- `npm test` sikeres.

## Függőségek

- `remote_layer_phase1_foundation_20260322`
- `remote_layer_phase2_discovery_auth_20260322`

## Megjegyzés

Ez a track rekonstrukció a dokumentum hiányzó Fázis 3 szakaszából. Különösen fontos, mert a Fázis 4 explicit módon erre a bridging szintre hivatkozik.
