# Implementacios Terv: Mission Templates & Test Cadence DevEx Optimization

## Cel
A fejlesztesi es uzemeltetesi donteseket sablonositsuk: mission template-ekkel, mission plannerrel es test cadence advisorral minden uj feladat uzemszeruen indithato legyen, ne fejbol kelljen kitalalni a parancsokat.

## Kiindulasi alap
- `src/core/sdlcPipeline.ts`
- `src/cli/conductorCommands.ts`
- `src/cli.ts`
- `src/dashboard/components/dashboard/MissionControlLayout.tsx`
- `src/dashboard/lib/navigation.tsx`
- `README.md` teszt workflow szakaszai

## Fazisok
### 1. Mission template schema
- Mission YAML schema definialasa.
- 3-5 kezdo template seed elokeszitese.
- Track, CLI, dashboard referenciak beemelese.

### 2. Mission planner
- Goal-to-step expansion tool implementalasa.
- CLI wizard a mission run folyamatra.
- Dashboard mission selector / launcher bekotese.

### 3. Test cadence advisor
- Diff vagy track alapjan tesztmatrix javaslat.
- Minimal / recommended / full teszt szintek.
- Eredmeny CLI es dashboard megjelenitese.

### 4. Verifikacio
- Template parser tesztek.
- Advisor tesztek.
- Build, CLI smoke es conductor rescan ellenorzes.

## Acceptance kriteriumok
- Egy misszio futtathato templatebol.
- A test plan javaslat ugyanazon szabalyokra epul CLI-n es dashboardon.
- A workflowk kevesebb manualis dontest igenyelnek.
- A track active marad es verifikalhato.
