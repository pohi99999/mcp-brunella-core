# AutoGen GitHub Models pilot a Python MCP alrendszerben

**Track ID:** `autogen_github_models_pilot_20260401`
**Cél:** izolált AutoGen adapter + GitHub Models-first futtatás + MCP tool, minimális kockázattal a meglévő Python backendre.

---

## Feladatok

- [x] Track scaffold létrehozása a pilot munkához.
- [x] Python függőségek felvétele az AutoGen pilot számára.
- [x] Izolált backend adapter létrehozása GitHub Models-first provider routinggal.
- [x] Ollama fallback hozzáadása `auto` provider módban.
- [x] Új MCP tool hozzáadása a Python MCP szerverhez.
- [x] `system_health` bővítése AutoGen capability checkkel.
- [x] Célzott unit tesztek írása az adapterhez és a tool JSON válaszformátumához.
- [x] Validáció futtatása.
- [x] Copilot napló és FŐSZÁL szinkronizáció frissítése.

## Eredmény

- a pilot nem piszkálja a megosztott `IronCladProviderGateway` réteget,
- az AutoGen csomagok külön `autogen` optional extra alatt maradnak, így a blast radius kisebb,
- a GitHub Models a preferált provider, de token hiányában az `auto` útvonal Ollamára esik vissza,
- az új belépési pont MCP toolként használható a Brunella Python alrendszerből,
- a REST integráció későbbi, külön szeletben vezethető be a jelenlegi `myai/server.py` szerkezeti kockázatai miatt.
