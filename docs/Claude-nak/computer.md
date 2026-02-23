✦ Számítógép Használat MCP (Playwright • aszinkron)

&nbsp; ---

&nbsp; Eszközök (MCP):

&nbsp; • initialize\_browser(url, width=1440, height=900, headless=?)

&nbsp; • execute\_action(action\_name, args)

&nbsp;     Támogatott: open\_web\_browser, click\_at, type\_text\_at,

&nbsp;                scroll\_to\_percent, enter\_text\_at, select\_option\_at,

&nbsp;                drag\_and\_drop, press\_key, execute\_javascript

&nbsp; • capture\_state(action\_name, result\_ok=true, error\_msg="")

&nbsp; • close\_browser()





&nbsp; Gyakori parancsok:

&nbsp; /computeruse:init url="https://example.com"                Böngésző inicializálása + URL megnyitása (alapértelmezetten headless)

&nbsp; /computeruse:init url="https://google.com" headless=false  Inicializálás látható ablakkal (headful)

&nbsp; /computeruse:open url="https://..."                        Navigálás az aktuális oldalon

&nbsp; /computeruse:click x=500 y=500                             Kattintás normalizált koordinátákon (0..1000 skála)

&nbsp; /computeruse:type  x=220 y=120 text="hello" press\_enter=true|false

&nbsp;                                                 Fókusz → csere → gépelés

&nbsp; /computeruse:scroll y=700                                  Görgetés függőleges százalékra (0..1000)

&nbsp; /computeruse:press key="End"                               Billentyű vagy billentyűkombináció lenyomása (pl. "Meta+L")

&nbsp; /computeruse:js code="..."                                 JS futtatása (ha implementálva van)

&nbsp; /computeruse:state prompt="Összegezd ezt az oldalt"        Képernyőkép → opcionális Gemini prompt a képre

&nbsp; /computeruse:macro actions='\[{"name":"click\_at","args":{"x":500,"y":500}}, ..



/computeruse:js code="..."                                 JS futtatása (ha implementálva van)

&nbsp; /computeruse:state prompt="Összegezd ezt az oldalt"        Képernyőkép → opcionális Gemini prompt a képre

&nbsp; /computeruse:macro actions='\[{"name":"click\_at","args":{"x":500,"y":500}}, ...]'

&nbsp; /computeruse:close                                         Böngésző bezárása





&nbsp; Headless / Headful:

&nbsp; • Az alapértelmezett a headless (csendes, háttérben futó).

&nbsp; • Használd a headless=false paramétert a /computeruse:init parancsnál az ablak megjelenítéséhez.

&nbsp; • Környezeti változók a szerver indításakor:

&nbsp;    - CU\_HEADFUL=1   → alapértelmezetten headful kényszerítése

&nbsp;    - CU\_NO\_SANDBOX=1 (Linux, megbízható környezetben) → --no-sandbox hozzáadása





&nbsp; Megjegyzések:

&nbsp;  - A koordináták normalizáltak (0..1000) és az aktuális viewport pixelekre konvertálódnak, amelyet a /computeruse:init állít be.

&nbsp;  - Néhány művelet még csak vázlatos; barátságos figyelmeztetést fogsz látni, amíg nincs implementálva az MCP-ben.

&nbsp;  - Ha a „Browser not initialized” üzenetet látod, futtasd először a /computeruse:init parancsot.

