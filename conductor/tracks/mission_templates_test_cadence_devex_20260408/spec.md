# Specifikacio: Mission Templates & Test Cadence DevEx Optimization

## Hatter
A Brunella rendszerben a CLI, a dashboard es a tesztelesi protokoll mar most nagyon gazdag. Ez a track az explicit mission/template/teszt-tervezesi reteg bevezetesevel csokkenti a fejben tartando operacios donteseket.

## Scope
- Mission YAML sablonok.
- Mission planner goal-to-step logika.
- Test cadence advisor diff/track alapjan.
- CLI mission run es test plan parancsok.
- Dashboard mission/test planning feluletek.

## Outside scope
- CI/CD platform atirasa.
- Teljes SDLC engine rewrite.
- Nem Brunella jellegu workflow sablonok.

## Implementacios celpontok
- `missions/*.yaml`
- `src/tools/missionPlanner.ts`
- `src/tools/testCadenceAdvisor.ts`
- `src/cli/missionCommands.ts`
- `src/dashboard/components/dashboard/MissionPlannerPanel.tsx`
- `src/dashboard/components/dashboard/TestPlanPanel.tsx`
- `src/dashboard/lib/navigation.tsx`
- `src/cli.ts`
- `test/missionPlanner.test.ts`
- `test/testCadenceAdvisor.test.ts`

## Acceptance kriteriumok
- Egy mission template-bol CLI-n indithato workflow keszul.
- A test cadence advisor automatikusan ad tesztstrategiat.
- A dashboard es CLI ugyanazt a javasolt lepeslistat mutatja.
- A trackhez tartozó tesztek zoldre futnak.

## Rollout
1. Template schema.
2. Planner.
3. Test cadence advisor.
4. Dashboard/CLI rollout.
