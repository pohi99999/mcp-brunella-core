# Spec: Brunella Identity + Project Maintainer

## Track ID

`brunella_identity_project_maintainer_20260402`

## Célkitűzés

Miután a Brunella Core stabil alapot kap, a következő lépés a **Brunella** rendszeridentitás és a **Project Maintainer** szerep explicit kialakítása.

## Brunella szerepe

1. **Brunella nem egyetlen agent**, hanem a teljes rendszeridentitás.
2. A felhasználó a **Copilot CLI-n keresztül** Brunellával kommunikál napi szinten.
3. Brunella fogja össze:
   - Orchestrator
   - Zero-Prompt runtime
   - Phoenix
   - scheduler
   - learning loop
   - később federation

## Project Maintainer szerepe

1. Külön szerep legyen, ne legyen összemosva a schedulerrel.
2. Minden nap **22:00-kor** fusson.
3. Az első verzió csak **report-only / dry-run** módban működjön.
4. Figyelje:
   - root zaj
   - log / artefact szemetet
   - rossz helyre került fájlokat
   - trackek állapotát
   - repo szerkezeti eltéréseit
5. Az első verzió ne legyen agresszív: csak javasoljon, allowlist alapján archiváljon, és készítsen jelentést.

## Scope

- Brunella identity definíció
- Project Maintainer felelősségi kör
- Scheduler / Janitor / Maintainer boundary
- napi 22:00 karbantartási ciklus
- report-only működés
- allowlist archiválási szabályok
- dashboard / CLI / log output design

## Kimenetek

- Brunella identity dokumentált modell
- Project Maintainer service / agent célkép
- napi maintenance workflow definíció
- report-only első iteráció
- allowlist alapú archiválási elvek
- karbantartási jelentés szerkezete

## Nem része ennek a fázisnak

- automatikus, destruktív repo-átrendezés
- federation mély integráció
- reflection loop implementáció
- ephemeral trigger bridge implementáció

## Acceptance kritériumok

- Egyértelműen szét van választva a Brunella identity, a scheduler és a Project Maintainer szerepe.
- A Project Maintainer napi 22:00-kor futó report-only működése leírva.
- A root cleanup és archiválási szabályok allowlist-alapúak.
- Az első iteráció nem mozgat agresszíven fájlokat emberi validáció nélkül.
- A dashboard / CLI felé egyértelműen meg van határozva a riportolási felület.

## Függőségek

- `brunella_core_stabilization_20260402`
- meglévő scheduler réteg
- `.github/agents/bas-workspace-janitor.agent.md`
- cleanup script-ek és conductor track rendszer

## Megjegyzés

Ez a track adja meg azt a “valódi vezénylő” réteget, amit a felhasználó keres: Brunella mint központi rendszerpersona, és Project Maintainer mint napi rendfenntartó-operátor.
