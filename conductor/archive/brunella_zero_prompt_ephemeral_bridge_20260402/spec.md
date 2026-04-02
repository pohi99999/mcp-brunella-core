# Spec: Brunella Zero-Prompt → Ephemeral Agent Bridge

## Track ID

`brunella_zero_prompt_ephemeral_bridge_20260402`

## Háttér

A Zero-Prompt nálad már erős, az ephemeral agent rendszer is valós. A következő lépés az, hogy a Zero-Prompt események:

- ne csak észleljenek
- hanem valóban keltsenek életre dinamikus ágenseket
- kontrollált, policy-alapú módon

Ez fogja megadni azt az érzést, hogy Brunella tényleg proaktív, nem csak “okos”.

## Cél

1. A Zero-Prompt eseményekből explicit, policy-alapú agent-spawn döntések szülessenek.
2. Az ephemeral agentek csak kontrollált sandboxban, scoped tool-hozzáféréssel induljanak.
3. A rendszer tudjon különbséget tenni auto-spawn, approval-required és escalation-only között.

## Scope

- Zero-Prompt trigger taxonomy
- ephemeral spawn policy mapping
- approval és escalation boundary
- audit trail és sandbox elvek
- dashboard / CLI láthatóság
- költség és kockázati guardrail-ek

## Kimenetek

- Zero-Prompt → ephemeral híd célarchitektúra
- trigger és spawn szabályrendszer
- approval / escalation határmodell
- audit és sandbox elváráslista
- operator visibility terv

## Nem része ennek a fázisnak

- federation alapú távoli ephemeral spawn
- multi-region agent placement
- teljes költségoptimalizációs alrendszer

## Acceptance kritériumok

- Meghatározott eseménytípusokból reprodukálható spawn döntés születik.
- Az automatikusan indított ágensek scoped, auditált és policy-kompatibilis működésűek.
- Van külön auto-spawn, approval és escalation ág.
- A felhasználó a dashboardon és/vagy CLI-ben átlátja a proaktív dinamikus aktivitást.

## Függőségek

- `brunella_core_stabilization_20260402`
- `brunella_identity_project_maintainer_20260402`
- `brunella_reflection_continual_learning_20260402`
- meglévő Zero-Prompt és ephemeral komponensek

## Megjegyzés

Ez a track köti össze a már meglévő két erős réteget: az eseményvezérelt felismerést és a dinamikus, eldobható specializált ágenseket.
