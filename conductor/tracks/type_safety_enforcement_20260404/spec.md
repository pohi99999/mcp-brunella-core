# Specifikáció: Type Safety Enforcement

## 🎯 Célkitűzés
A Brunella kódbázis típusbiztonságának megerősítése az `any` típusok szisztematikus kivezetésével. A cél a README-ben rögzített `any` tilalom 100%-os érvényesítése és a `unknown` + Type Guard minták elterjesztése.

## ⚠️ Jelenlegi Probléma
- 100+ találat a `: any` deklarációkra kritikus modulokban (RAG, DB, Browser).
- A linter warningokat figyelmen kívül hagyó `eslint-disable` direktívák.
- Megnövekedett kockázat a futásidejű hibákra (runtime errors).

## ✅ Elvárt Állapot
- 0 darab `: any` a production kódban (kivéve ahol technikai kényszer van, de ott dokumentálva).
- Megfelelő interfészek és típusok definiálása a most `any`-t használó adatstruktúrákhoz.
- `unknown` használata bejövő külső adatoknál (pl. API válaszok, tool paraméterek).

## 🛠️ Technikai Követelmények
- Interfészek kinyerése a JSON minták alapján.
- Type guard függvények (pl. `isAgentResponse()`) implementálása.
- TypeScript szigorú mód (strict) integritásának megőrzése.
