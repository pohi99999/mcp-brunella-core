# Agent Loader Modernization — 2026-03-23

## Cél
A Brunella agent betöltés professzionálisabbá tétele úgy, hogy az `AgentManager` kezelje a default exportot, a named exportot és a félrekonfigurált registry bejegyzések jobb diagnosztikáját.

## Probléma
A startup során több agent `TypeError: AgentClass is not a constructor` hibával esik el, miközben a forrásfájlok valós agent osztályokat exportálnak named exportként. A jelenlegi betöltő csak a `default` exportot próbálja használni.

## Megoldás
1. Az `AgentManager.loadAgent()` oldja fel a modult `default`, majd `config.class`, végül első konstruktor-jellegű export alapján.
2. A hibaüzenet legyen diagnosztikus: modulútvonal, elérhető exportok, várt osztálynév.
3. Adjunk regressziós teszteket az exportfeloldásra.

## Sikerkritérium
- A named exportot használó agentek sikeresen betöltődnek.
- A hibás registry vagy hibás export informatívabb logot kap.
- Build és célzott tesztek zöldek.
