# Specifikáció: Type Safety Follow-up — Browser and Wrangler helpers

## 🎯 Célkitűzés
A type-safety track utólagos, önálló folytatása a még fennmaradó helper-szintű `any` használat megszüntetésére. A fókusz a `persistentBrowser.ts` és `wranglerHelper.ts` fájlokon van, mert ezek továbbra is széles `any`/JSON parsing mintákat használnak.

## ⚠️ Jelenlegi Probléma
- A browser worker JSON sorait `safeJsonParse<any>` és laza response típusok kezelik.
- A Wrangler helper D1 kimeneteket és modulválaszokat még mindig széles, nem típusos formában kezeli.
- Ezek a minták rontják a hibadetektálást és megnehezítik a későbbi refaktorokat.

## ✅ Elvárt Állapot
- Nincs új `any` usage a két helperben, kivéve ahol külső library kényszeríti, és az külön dokumentált.
- A JSON parsing `unknown` + guard mintára vált.
- A public behavior és az elérhető CLI/browser funkciók változatlanok maradnak.

## 🛠️ Technikai Követelmények
- Külső válaszokhoz típusos response interface-ek vagy guard függvények.
- A parsing fallbackek ugyanúgy visszaadják a jelenlegi default értékeket.
- A change set maradjon külön trackben, ne keveredjen a DB vagy RAG refaktorral.
