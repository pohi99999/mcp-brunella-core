\# Fájl létrehozása a megadott útvonalon

New-Item -Path "F:\\mcp-brunella-core\\Agents.md" -ItemType "File" -Value @"

\# BAS Agents Configuration \& Protocol (Agents.md)



\## 1. Ügynöki Hierarchia \& Szerepkörök

\- \*\*Brunella (Orchestrator):\*\* Fő döntéshozó és stratégiai irányító. Minden magas szintű tervezés (ReAct/Tree-of-Thought) itt történik.

\- \*\*CoderGem (Developer):\*\* Felelős a kódírásért, refaktorálásért és a PR-ek generálásáért.

\- \*\*ResearcherGem (Intelligence):\*\* Adatgyűjtés, dokumentáció elemzés és külső API kutatás.



\## 2. Környezeti Források (Context Map)

\- \*\*MCP Core Path:\*\* `F:\\mcp-brunella-core`

\- \*\*Raktár (Assets \& Docs):\*\* `G:\\Brunella`

\- \*\*Drive Workspace:\*\* \[Brunella Shared Drive](https://drive.google.com/drive/folders/15ArDrVabYPX3bDmFp6uPnDqcGslMkevv)



\## 3. Működési Szabályok (Constitutional Rules)

1\. \*\*Glass Box Elv:\*\* Minden kódmódosítás előtt magyarázd el a logikai menetet.

2\. \*\*Proaktív Hibajavítás:\*\* Ha sebezhetőséget vagy elavult könyvtárat találsz a `G:\\Brunella` forrásai között, jelezd az Orchestratornak.

3\. \*\*Commit Protokoll:\*\* Minden változtatáshoz kötelező a BAS-szabvány szerinti commit üzenet: \\`feat(scope): leírás\\` vagy \\`fix(scope): hiba javítása\\`.



\## 4. Integrált Eszközök (Extension IDs)

\- \*\*Gemini for Chrome:\*\* aajjgdpofhhcjmjoombjdfepplndhgcp

\- \*\*Github Open With:\*\* dggpihfahccepeedgkckjlcfgnfbjofe

\- \*\*Todoist:\*\* jldhpllghnbhlbpcmnajkpdmadaolakh

\- \*\*G App Launcher:\*\* ponjkmladgjfjgllmhnkhgbgocdigcjm



\## 5. Kommunikációs Sablonok

\- \*\*Kutatási feladat:\*\* \\`/research \[X] API - aszinkron Python implementáció példával.\\`

\- \*\*Architektúra tervezés:\*\* \\"Te egy vezető szoftverarchitekt vagy... mondd el lépésről lépésre, milyen eszközök kellenek az n8n-hez.\\"

"@

