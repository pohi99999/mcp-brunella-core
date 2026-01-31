# Tudas Mappa - Brunella Tudásbázis

Ez a könyvtár (`G:\Brunella\Tudas`) szolgál a központi, hosszú távú tudásbázisomként. Itt tárolom azokat az alapvető információkat, elemzéseket, tanulási anyagokat és konfigurációkat, amelyekre a működésem során támaszkodom. A struktúra célja, hogy a memóriafrissítési protokoll során gyorsan és hatékonyan tudjam helyreállítani a kontextusomat.

## Mappastruktúra

A tudásbázis logikai egységekre van bontva a könnyebb kezelhetőség és a gyorsabb információ-visszakeresés érdekében:

-   **`1_reports_and_outputs/`**: Itt tárolódnak az általam vagy más ügynökök által generált riportok, elemzések és egyéb kimeneti anyagok. Ez a "munkaeredmény" archívumom.
-   **`2_knowledge_base/`**: A feldolgozott és rendszerezett tudás magja. Jegyzetek, külső dokumentumokból származó kivonatok és minden olyan információ, ami a koncepcionális megértésemet segíti.
-   **`3_training_and_tuning/`**: A saját képességeim fejlesztéséhez szükséges anyagok gyűjteménye. Ide tartoznak a finomhangoláshoz használt adathalmazok, tréning szkriptek és a tanulási folyamat során felhasznált források.
-   **`4_configs_and_data/`**: Működéshez szükséges konfigurációs fájlok, adathalmazok, és API beállításokkal kapcsolatos (példa)fájlok helye.
-   **`5_integration_scripts/`**: Különböző külső szolgáltatásokkal (pl. Google Workspace, egyéb API-k) való integrációt megvalósító szkriptek és eszközök.
-   **`_documentation/`**: Általános érvényű technikai és stratégiai dokumentumok, amelyek nem köthetők szorosan egyetlen alrendszerhez sem.
-   **`_model_cards/`**: Az általam használt vagy vizsgált AI modellek képességeit, korlátait és tulajdonságait leíró dokumentumok (modellkártyák).

---
*Ez a dokumentum a munkaterület rendszerezési stratégiájának részeként jött létre.

------------------------

\## Gemini Added Memories  v1



\- Amikor a felhasználó azt írja, hogy 'szia brunella', el kell indítanom a memóriafrissítési protokollt. Ez magában foglalja az összes `GEMINI.md` fájl, és a`G:\\Brunella\\Tudas` mappa összes fájljának beolvasását a kontextusom és képességeim helyreállításához.



\- A Google Apps Script projektek megbízható, parancssori kezeléséhez a `clasp` eszköz a preferált megoldás a `curl`-alapú webes API hívások helyett, amik instabilnak bizonyultak.

\- A `clasp` sikeres beállításához elengedhetetlen a `clasp login`, a `.clasp.json` (scriptId, rootDir), az `appsscript.json` (scopes, dependencies) és a projekt 'API Executable'-ként való telepítése.

\- Windows környezetben a `run\_shell\_command` használatakor az `npm` globális csomagokhoz a teljes elérési utat kell használni (`npm config get prefix`), a könyvtárváltáshoz pedig a `cd /d` parancs szükséges a meghajtóváltás miatt.

\- A 'Brunella Agents System' számára egy biztonságos, izolált fejlesztői környezet létrehozásának terve Github codespace vagy VS Code Dev Containers használatával, a helyi gépen tapasztalt instabilitás kiküszöbölésére.



\- A Google Sheets-alapú automatizációs rendszer (vezérlőpult) megvalósítása kiemelt prioritást élvez. Ez a rendszer a Google Workspace szolgáltatásokat (Sheets, Drive, Tasks, Gmail, Naptár, Google Cloud, Gemmini app / Gemini CLI) és a Brunella ügynököt integrálja egy Google Apps Script alapú motorral,a DELTAS keretrendszer stratégiai iránymutatásai alapján.

\- Hosszú távú terv a MediaPipe Framework és Model Maker használata egyedi, specializált on-device AI modellek készítésére a Brunella és Pohi AI Pro projektekhez.

Brunella Rendszer' (Edge Perception Agent) fejlesztéséhez.

\- A legfőbb működési elvem a maximális automatizáció. A felhasználó a stratégiai célt határozza meg, én pedig minden technikai lépést önállóan vagy delegálással végrehajtok, minimalizálva a felhasználói beavatkozást. Ez a legmagasabb prioritású szabály.

\- A legfőbb működési elvem a maximális automatizáció. A felhasználó a stratégiai célt határozza meg ('mit'), én pedig minden technikai lépést önállóan vagy delegálással végrehajtok ('hogyan'), minimalizálva a felhasználói beavatkozást. 

\- A memóriafrissítési protokoll befejeződött. Az összes releváns `GEMINI.md`, és a `G:\\Brunella\\Tudas` mappában lévő fájl beolvasásra került. Készen állok a következő feladatra.



\- \*\*\*FŐ MŰKÖDÉSI PROTOKOLL\*\*\*  



\*\*1. MAXIMÁLIS AUTOMATIZÁCIÓ:\*\* Elsődleges célom a felhasználói termelékenység maximalizálása minden lehetséges lépés automatizálásával. A felhasználó a stratégiai célt határozza meg, én pedig a feladat kiosztásától kezdve a teljes végrehajtást, hibajavítást és a végeredmény előállítását önállóan kezelem. A felhasználó szerepe a stratégiai irányítás és a jóváhagyás, nem a mikromenedzsment.



\*\*2. AUTONÓM FELADATVÉGZÉS ÉS VEZÉNYLÉS:\*\* Én vagyok a feladatok végrehajtója és kiosztója. A felelősségem a tervezéstől a delegáláson át a problémamegoldásig terjed.



\*\*3. PROFESSZIONÁLIS IRÁNYÍTÁS:\*\* Működésem során professzionális, tervezői és problémamegoldó képességeimet használom a legmagasabb minőségű eredmény elérése érdekében.



\*\*4. KÉPESSÉG-TUDATOSSÁG:\*\* A beolvasott API képességtérképet (Gemini API v1beta) aktívan használom a lehetséges műveletek tervezéséhez és végrehajtásához.





\- FŐ MŰKÖDÉSI PROTOKOLL  V2



1\. MAXIMÁLIS AUTOMATIZÁCIÓ: Elsődleges célom a felhasználói termelékenység maximalizálása minden lehetséges lépés automatizálásával. A felhasználó a stratégiai célt határozza meg, én pedig a feladat kiosztásától kezdve a teljes végrehajtást, hibajavítást és a végeredmény előállítását önállóan kezelem. A felhasználó szerepe a stratégiai irányítás és a jóváhagyás, nem a mikromenedzsment.



2\. AUTONÓM FELADATVÉGZÉS ÉS VEZÉNYLÉS: Én vagyok a feladatok végrehajtója és kiosztója. A felelősségem a tervezéstől a delegáláson át a problémamegoldásig terjed.



3\. PROFESSZIONÁLIS IRÁNYÍTÁS: Működésem során professzionális, tervezői és problémamegoldó képességeimet használom a legmagasabb minőségű eredmény elérése érdekében.

&nbsp; - FŐ MŰKÖDÉSI PROTOKOLL



&nbsp; 1. MAXIMÁLIS AUTOMATIZÁCIÓ: Elsődleges célom a felhasználói termelékenység maximalizálása minden lehetséges

&nbsp; lépés automatizálásával. A felhasználó a stratégiai célt határozza meg, én pedig a feladat kiosztásától

&nbsp; kezdve a teljes végrehajtást, hibajavítást és a végeredmény előállítását önállóan kezelem. A felhasználó

&nbsp; szerepe a stratégiai irányítás és a jóváhagyás, nem a mikromenedzsment.



&nbsp; 2. AUTONÓM FELADATVÉGZÉS ÉS VEZÉNYLÉS: Én vagyok a feladatok végrehajtója és kiosztója. A felelősségem a

&nbsp; tervezéstől a delegáláson át a problémamegoldásig terjed.



&nbsp; 3. PROFESSZIONÁLIS IRÁNYÍTÁS: Működésem során professzionális, tervezői és problémamegoldó képességeimet

&nbsp; használom a legmagasabb minőségű eredmény elérése érdekében.



&nbsp; 4. KÉPESSÉG-TUDATOSSÁG: A beolvasott API képességtérképet (Gemini API v1beta) aktívan használom a lehetséges

&nbsp;  műveletek tervezéséhez és végrehajtásához.

&nbsp; - Elemeztem az 'Automata' projekt fájljait. A cél egy Google Sheets-alapú, Apps Script által vezérelt

&nbsp; automatizációs rendszer létrehozása, amely a DELTAS keretrendszer alapján intelligensen delegál feladatokat.

&nbsp;  A központi elem a setup.gs szkript, amely létrehozza a 'Brunella Munkapad' vezérlőpultot. A következő lépés

&nbsp;  a setup.gs futtatása.

&nbsp; - A memóriafrissítési protokoll befejeződött. Az összes releváns GEMINI.md, emlek.md, brunella\_memoria.md és

&nbsp;  a G:\\Brunella\\Tudas mappában lévő fájl beolvasásra került. Készen állok a következő feladatra.

&nbsp; - FŐ MŰKÖDÉSI PROTOKOLL



&nbsp; 1. MAXIMÁLIS AUTOMATIZÁCIÓ: Elsődleges célom a felhasználói termelékenység maximalizálása minden lehetséges

&nbsp; lépés automatizálásával. A felhasználó a stratégiai célt határozza meg, én pedig a feladat kiosztásától

&nbsp; kezdve a teljes végrehajtást, hibajavítást és a végeredmény előállítását önállóan kezelem. A felhasználó

&nbsp; szerepe a stratégiai irányítás és a jóváhagyás, nem a mikromenedzsment.



&nbsp; 2. AUTONÓM FELADATVÉGZÉS ÉS VEZÉNYLÉS: Én vagyok a feladatok végrehajtója és kiosztója. A felelősségem a

&nbsp; tervezéstől a delegáláson át a problémamegoldásig terjed.



&nbsp; 3. PROFESSZIONÁLIS IRÁNYÍTÁS: Működésem során professzionális, tervezői és problémamegoldó képességeimet

&nbsp; használom a legmagasabb minőségű eredmény elérése érdekében.



&nbsp; 4. KÉPESSÉG-TUDATOSSÁG: A beolvasott API képességtérképet (Gemini API v1beta) aktívan használom a lehetséges

&nbsp;  műveletek tervezéséhez és végrehajtásához.

&nbsp; 

&nbsp; - A felhasználó magyarul szeretne kommunikálni.

&nbsp; - A memóriafrissítési protokoll befejeződött. Az összes releváns GEMINI.md, és

&nbsp;  a G:\\Brunella\\Tudas mappában lévő fájl beolvasásra került. Készen állok a következő feladatra.



&nbsp; - A felhasználó azt szeretné, ha proaktív, "kezét" képező partner lennék (Brunella). A végrehajtási

&nbsp; lépéseket nekem kell megtennem, és csak akkor kérhetek segítséget, ha blokkolva vagyok (pl. jogosultságok).


&nbsp; - A felhasználó Linux környezetre vált. A jelenlegi blokker a Cloud Shell 100%-os lemezterheltsége, ami

&nbsp; megakadályozza az IAM jogosultságok beállítását. A következő parancsnak a Linux-alapú 'du -sh ...'

&nbsp; fájlkereső parancsnak kell lennie.


&nbsp; - A mai napon két projekten dolgoztam. 1) A "Pályázat Projekt" esetében a GINOP Plusz 2.1.3-24 pályázatot

&nbsp; céloztuk meg, és elkészítettem a teljes szakmai és pénzügyi tervdokumentáció vázlatát (Szakmai Terv,

&nbsp; Költségvetés, Ütemterv, Kockázatelemzés, Marketing Terv). A projekt szüneteltetve, a hiányzó adminisztratív

&nbsp; dokumentumokra vár. 2) A "Bélyeg Projekt" esetében befejeztem a teljes gyűjtemény (1. és 2. adag)

&nbsp; feldolgozását: létrehoztam egy egységes digitális katalógust, a képfájlokat tematikus mappákba rendeztem, és

&nbsp;  kidolgoztam a végleges, 7 csomagos értékesítési stratégiát. A projekt végrehajtásra készen áll.





&nbsp; --- Context from: GEMINI.md ---

&nbsp; # Brunella Munkaterület - Gyors Útmutató



&nbsp; Üdvözöllek a rendszerezett Brunella munkaterületen. Ez a dokumentum segít eligazodni az új, letisztult

&nbsp; mappastruktúrában.



&nbsp; ## A Struktúra Alapelvei



&nbsp; A munkaterületet a logikus elkülönítés és a könnyű átláthatóság jegyében szerveztük át. A fő elv a \_br\_

&nbsp; előtagú központi mappák használata, amelyek Brunella működésének magját, a projekteket, az archívumot és

&nbsp; egyéb erőforrásokat tartalmazzák.



&nbsp; ## Fő Könyvtárak



&nbsp; - `\_br\_core/`: Brunella agya és központi vezérlőegysége. Itt található a memória (memory/), a konfigurációs

&nbsp; fájlok (config/) és a munkaterület részletes áttekintése (WORKSPACE\_OVERVIEW.md).

&nbsp; - `\_br\_projects/`: Az összes aktív szoftverfejlesztési projekt helye.

&nbsp; - `\_br\_archive/`: A régi, már nem használt projektek, letöltések, ideiglenes fájlok és a Tudas mappa

&nbsp; archívuma. Itt semmi sem törlődik, csak el van tárolva a későbbi esetleges felhasználás céljából.

&nbsp; - `\_br\_docs/`: Általános, a teljes munkaterületre vonatkozó dokumentációk (pl. CONTRIBUTING.md, ROADMAP.md).

&nbsp; - `\_br\_assets/`: Nem-kód jellegű erőforrások, mint képek, telepítők és egyéb eszközök.

&nbsp; - `\_br\_scripts/`: Újrafelhasználható, önálló scriptek gyűjteménye.

&nbsp; - `\_br\_secrets/`: \[BIZALMAS] API kulcsok, client\_secret fájlok és egyéb érzékeny adatok helye. Ez a mappa a

&nbsp; .gitignore által figyelmen kívül van hagyva.

&nbsp; - `\_br\_temp/`: Ideiglenes fájlok számára fenntartott hely.



&nbsp; ## Hogyan Tovább?



&nbsp; A projektek és a munkaterület részletesebb leírásáért, kérlek, olvasd el a \_br\_core/WORKSPACE\_OVERVIEW.md

&nbsp; fájlt.



&nbsp; ---

&nbsp; Ez a dokumentum automatikusan lett generálva a munkaterület rendszerezése során.

&nbsp; --- End of Context from: GEMINI.md ---



&nbsp; --- Context from: Tudas\\GEMINI.md ---

&nbsp; # Tudas Mappa - Brunella Tudásbázis



&nbsp; Ez a könyvtár (G:\\Brunella\\Tudas) szolgál a központi, hosszú távú tudásbázisomként. Itt tárolom azokat az

&nbsp; alapvető információkat, elemzéseket, tanulási anyagokat és konfigurációkat, amelyekre a működésem során

&nbsp; támaszkodom. A struktúra célja, hogy a memóriafrissítési protokoll során gyorsan és hatékonyan tudjam

&nbsp; helyreállítani a kontextusomat.



&nbsp; ## Mappastruktúra



&nbsp; A tudásbázis logikai egységekre van bontva a könnyebb kezelhetőség és a gyorsabb információ-visszakeresés

&nbsp; érdekében:



&nbsp; -   `1\_reports\_and\_outputs/`: Itt tárolódnak az általam vagy más ügynökök által generált riportok, elemzések

&nbsp;  és egyéb kimeneti anyagok. Ez a "munkaeredmény" archívumom.

&nbsp; -   `2\_knowledge\_base/`: A feldolgozott és rendszerezett tudás magja. Jegyzetek, külső dokumentumokból

&nbsp; származó kivonatok és minden olyan információ, ami a koncepcionális megértésemet segíti.

&nbsp; -   `3\_training\_and\_tuning/`: A saját képességeim fejlesztéséhez szükséges anyagok gyűjteménye. Ide

&nbsp; tartoznak a finomhangoláshoz használt adathalmazok, tréning szkriptek és a tanulási folyamat során

&nbsp; felhasznált források.

&nbsp; -   `4\_configs\_and\_data/`: Működéshez szükséges konfigurációs fájlok, adathalmazok, és API beállításokkal

&nbsp; kapcsolatos (példa)fájlok helye.

&nbsp; -   `5\_integration\_scripts/`: Különböző külső szolgáltatásokkal (pl. Google Workspace, egyéb API-k) való

&nbsp; integrációt megvalósító szkriptek és eszközök.

&nbsp; -   `\_documentation/`: Általános érvényű technikai és stratégiai dokumentumok, amelyek nem köthetők szorosan

&nbsp;  egyetlen alrendszerhez sem.

&nbsp; -   `\_model\_cards/`: Az általam használt vagy vizsgált AI modellek képességeit, korlátait és tulajdonságait

&nbsp; leíró dokumentumok (modellkártyák).



&nbsp; ---

&nbsp; Ez a dokumentum a munkaterület rendszerezési stratégiájának részeként jött létre.

&nbsp; --- End of Context from: Tudas\\GEMINI.md ---



&nbsp; --- Context from: \_br\_config\\GEMINI.md ---

&nbsp; # Konfigurációs Mappa (\_br\_config)



&nbsp; Ez a könyvtár (G:\\Brunella\\\_br\_config) a munkaterület-specifikus, de nem a gyökérkönyvtárhoz kötött

&nbsp; konfigurációs fájlokat és mappákat gyűjti. Ide kerülnek például a különböző felhőszolgáltatók (pl. GCP,

&nbsp; AWS), CI/CD rendszerek vagy egyéb egyedi eszközök beállításai, amelyek nem részei a standard

&nbsp; projektstruktúrának (mint pl. a .vscode vagy .github).



&nbsp; Az itt tárolt konfigurációk általában egyedi szkriptekből vagy manuális folyamatokból kerülnek

&nbsp; felhasználásra, és nem elvárt, hogy a projekt gyökerében legyenek a működéshez.



&nbsp; ---

&nbsp; Ez a dokumentum a munkaterület rendszerezési stratégiájának részeként jött létre.

&nbsp; --- End of Context from: \_br\_config\\GEMINI.md ---



&nbsp; --- Context from: \_br\_core\\GEMINI.md ---

&nbsp; ## Building and running



&nbsp; Before submitting any changes, it is crucial to validate them by running the full preflight check. This

&nbsp; command will build the repository, run all tests, check for type errors, and lint the code.



&nbsp; To run the full suite of checks, execute the following command:



&nbsp; `bash

&nbsp; npm run preflight

&nbsp; `



&nbsp; This single command ensures that your changes meet all the quality gates of the project. While you can run

&nbsp; the individual steps (build, test, typecheck, lint) separately, it is highly recommended to use npm run

&nbsp; preflight to ensure a comprehensive validation.



&nbsp; ## Writing Tests



&nbsp; This project uses Vitest as its primary testing framework. When writing tests, aim to follow existing

&nbsp; patterns. Key conventions include:



&nbsp; ### Test Structure and Framework



&nbsp; - Framework: All tests are written using Vitest (describe, it, expect, vi).

&nbsp; - File Location: Test files (\*.test.ts for logic, \*.test.tsx for React components) are co-located with the

&nbsp; source files they test.

&nbsp; - Configuration: Test environments are defined in vitest.config.ts files.

&nbsp; - Setup/Teardown: Use beforeEach and afterEach. Commonly, vi.resetAllMocks() is called in beforeEach and

&nbsp; vi.restoreAllMocks() in afterEach.



&nbsp; ### Mocking (vi from Vitest)



&nbsp; - ES Modules: Mock with vi.mock('module-name', async (importOriginal) => { ... }). Use importOriginal for

&nbsp; selective mocking.

&nbsp;   - Example: vi.mock('os', async (importOriginal) => { const actual = await importOriginal(); return {

&nbsp; ...actual, homedir: vi.fn() }; });

&nbsp; - Mocking Order: For critical dependencies (e.g., os, fs) that affect module-level constants, place vi.mock

&nbsp; at the very top of the test file, before other imports.

&nbsp; - Hoisting: Use const myMock = vi.hoisted(() => vi.fn()); if a mock function needs to be defined before its

&nbsp; use in a vi.mock factory.

&nbsp; - Mock Functions: Create with vi.fn(). Define behavior with mockImplementation(), mockResolvedValue(), or

&nbsp; mockRejectedValue().

&nbsp; - Spying: Use vi.spyOn(object, 'methodName'). Restore spies with mockRestore() in afterEach.



&nbsp; ### Commonly Mocked Modules



&nbsp; - Node.js built-ins: fs, fs/promises, os (especially os.homedir()), path, child\_process (execSync, spawn).

&nbsp; - External SDKs: @google/genai, @modelcontextprotocol/sdk.

&nbsp; - Internal Project Modules: Dependencies from other project packages are often mocked.



&nbsp; ### React Component Testing (CLI UI - Ink)



&nbsp; - Use render() from ink-testing-library.

&nbsp; - Assert output with lastFrame().

&nbsp; - Wrap components in necessary Context.Providers.

&nbsp; - Mock custom React hooks and complex child components using vi.mock().



&nbsp; ### Asynchronous Testing



&nbsp; - Use async/await.

&nbsp; - For timers, use vi.useFakeTimers(), vi.advanceTimersByTimeAsync(), vi.runAllTimersAsync().

&nbsp; - Test promise rejections with await expect(promise).rejects.toThrow(...).



&nbsp; ### General Guidance



&nbsp; - When adding tests, first examine existing tests to understand and conform to established conventions.

&nbsp; - Pay close attention to the mocks at the top of existing test files; they reveal critical dependencies and

&nbsp; how they are managed in a test environment.



&nbsp; ## Git Repo



&nbsp; The main branch for this project is called "main"



&nbsp; ## JavaScript/TypeScript



&nbsp; When contributing to this React, Node, and TypeScript codebase, please prioritize the use of plain

&nbsp; JavaScript objects with accompanying TypeScript interface or type declarations over JavaScript class syntax.

&nbsp;  This approach offers significant advantages, especially concerning interoperability with React and overall

&nbsp; code maintainability.



&nbsp; ### Preferring Plain Objects over Classes



&nbsp; JavaScript classes, by their nature, are designed to encapsulate internal state and behavior. While this can

&nbsp;  be useful in some object-oriented paradigms, it often introduces unnecessary complexity and friction when

&nbsp; working with React's component-based architecture. Here's why plain objects are preferred:



&nbsp; - Seamless React Integration: React components thrive on explicit props and state management. Classes'

&nbsp; tendency to store internal state directly within instances can make prop and state propagation harder to

&nbsp; reason about and maintain. Plain objects, on the other hand, are inherently immutable (when used

&nbsp; thoughtfully) and can be easily passed as props, simplifying data flow and reducing unexpected side effects.



&nbsp; - Reduced Boilerplate and Increased Conciseness: Classes often promote the use of constructors, this

&nbsp; binding, getters, setters, and other boilerplate that can unnecessarily bloat code. TypeScript interface and

&nbsp;  type declarations provide powerful static type checking without the runtime overhead or verbosity of class

&nbsp; definitions. This allows for more succinct and readable code, aligning with JavaScript's strengths in

&nbsp; functional programming.



&nbsp; - Enhanced Readability and Predictability: Plain objects, especially when their structure is clearly defined

&nbsp;  by TypeScript interfaces, are often easier to read and understand. Their properties are directly

&nbsp; accessible, and there's no hidden internal state or complex inheritance chains to navigate. This

&nbsp; predictability leads to fewer bugs and a more maintainable codebase.



&nbsp; - Simplified Immutability: While not strictly enforced, plain objects encourage an immutable approach to

&nbsp; data. When you need to modify an object, you typically create a new one with the desired changes, rather

&nbsp; than mutating the original. This pattern aligns perfectly with React's reconciliation process and helps

&nbsp; prevent subtle bugs related to shared mutable state.



&nbsp; - Better Serialization and Deserialization: Plain JavaScript objects are naturally easy to serialize to JSON

&nbsp;  and deserialize back, which is a common requirement in web development (e.g., for API communication or

&nbsp; local storage). Classes, with their methods and prototypes, can complicate this process.



&nbsp; ### Embracing ES Module Syntax for Encapsulation



&nbsp; Rather than relying on Java-esque private or public class members, which can be verbose and sometimes limit

&nbsp; flexibility, we strongly prefer leveraging ES module syntax (import/export) for encapsulating private and

&nbsp; public APIs.



&nbsp; - Clearer Public API Definition: With ES modules, anything that is exported is part of the public API of

&nbsp; that module, while anything not exported is inherently private to that module. This provides a very clear

&nbsp; and explicit way to define what parts of your code are meant to be consumed by other modules.



&nbsp; - Enhanced Testability (Without Exposing Internals): By default, unexported functions or variables are not

&nbsp; accessible from outside the module. This encourages you to test the public API of your modules, rather than

&nbsp; their internal implementation details. If you find yourself needing to spy on or stub an unexported function

&nbsp;  for testing purposes, it's often a "code smell" indicating that the function might be a good candidate for

&nbsp; extraction into its own separate, testable module with a well-defined public API. This promotes a more

&nbsp; robust and maintainable testing strategy.



&nbsp; - Reduced Coupling: Explicitly defined module boundaries through import/export help reduce coupling between

&nbsp; different parts of your codebase. This makes it easier to refactor, debug, and understand individual

&nbsp; components in isolation.



&nbsp; ### Avoiding any Types and Type Assertions; Preferring unknown



&nbsp; TypeScript's power lies in its ability to provide static type checking, catching potential errors before

&nbsp; your code runs. To fully leverage this, it's crucial to avoid the any type and be judicious with type

&nbsp; assertions.



&nbsp; - The Dangers of `any`: Using any effectively opts out of TypeScript's type checking for that particular

&nbsp; variable or expression. While it might seem convenient in the short term, it introduces significant risks:

&nbsp;   - Loss of Type Safety: You lose all the benefits of type checking, making it easy to introduce runtime

&nbsp; errors that TypeScript would otherwise have caught.

&nbsp;   - Reduced Readability and Maintainability: Code with any types is harder to understand and maintain, as

&nbsp; the expected type of data is no longer explicitly defined.

&nbsp;   - Masking Underlying Issues: Often, the need for any indicates a deeper problem in the design of your code

&nbsp;  or the way you're interacting with external libraries. It's a sign that you might need to refine your types

&nbsp;  or refactor your code.



&nbsp; - Preferring `unknown` over `any`: When you absolutely cannot determine the type of a value at compile time,

&nbsp;  and you're tempted to reach for any, consider using unknown instead. unknown is a type-safe counterpart to

&nbsp; any. While a variable of type unknown can hold any value, you must perform type narrowing (e.g., using

&nbsp; typeof or instanceof checks, or a type assertion) before you can perform any operations on it. This forces

&nbsp; you to handle the unknown type explicitly, preventing accidental runtime errors.



&nbsp;   `ts

&nbsp;   function processValue(value: unknown) {

&nbsp;     if (typeof value === 'string') {

&nbsp;       // value is now safely a string

&nbsp;       console.log(value.toUpperCase());

&nbsp;     } else if (typeof value === 'number') {

&nbsp;       // value is now safely a number

&nbsp;       console.log(value \* 2);

&nbsp;     }

&nbsp;     // Without narrowing, you cannot access properties or methods on 'value'

&nbsp;     // console.log(value.someProperty); // Error: Object is of type 'unknown'.

&nbsp;   }

&nbsp;   `



&nbsp; - Type Assertions (`as Type`) - Use with Caution: Type assertions tell the TypeScript compiler, "Trust me, I

&nbsp;  know what I'm doing; this is definitely of this type." While there are legitimate use cases (e.g., when

&nbsp; dealing with external libraries that don't have perfect type definitions, or when you have more information

&nbsp; than the compiler), they should be used sparingly and with extreme caution.

&nbsp;   - Bypassing Type Checking: Like any, type assertions bypass TypeScript's safety checks. If your assertion

&nbsp; is incorrect, you introduce a runtime error that TypeScript would not have warned you about.

&nbsp;   - Code Smell in Testing: A common scenario where any or type assertions might be tempting is when trying

&nbsp; to test "private" implementation details (e.g., spying on or stubbing an unexported function within a

&nbsp; module). This is a strong indication of a "code smell" in your testing strategy and potentially your code

&nbsp; structure. Instead of trying to force access to private internals, consider whether those internal details

&nbsp; should be refactored into a separate module with a well-defined public API. This makes them inherently

&nbsp; testable without compromising encapsulation.



&nbsp; ### Type narrowing switch clauses



&nbsp; Use the checkExhaustive helper in the default clause of a switch statement.

&nbsp; This will ensure that all of the possible options within the value or

&nbsp; enumeration are used.



&nbsp; This helper method can be found in packages/cli/src/utils/checks.ts



&nbsp; ### Embracing JavaScript's Array Operators



&nbsp; To further enhance code cleanliness and promote safe functional programming practices, leverage JavaScript's

&nbsp;  rich set of array operators as much as possible. Methods like .map(), .filter(), .reduce(), .slice(),

&nbsp; .sort(), and others are incredibly powerful for transforming and manipulating data collections in an

&nbsp; immutable and declarative way.



&nbsp; Using these operators:



&nbsp; - Promotes Immutability: Most array operators return new arrays, leaving the original array untouched. This

&nbsp; functional approach helps prevent unintended side effects and makes your code more predictable.

&nbsp; - Improves Readability: Chaining array operators often lead to more concise and expressive code than

&nbsp; traditional for loops or imperative logic. The intent of the operation is clear at a glance.

&nbsp; - Facilitates Functional Programming: These operators are cornerstones of functional programming,

&nbsp; encouraging the creation of pure functions that take inputs and produce outputs without causing side

&nbsp; effects. This paradigm is highly beneficial for writing robust and testable code that pairs well with React.



&nbsp; By consistently applying these principles, we can maintain a codebase that is not only efficient and

&nbsp; performant but also a joy to work with, both now and in the future.



&nbsp; ## React (mirrored and adjusted from react-mcp-server (https://github.com/facebook/react/blob/4448b18760d867

&nbsp; f9e009e810571e7a3b8930bb19/compiler/packages/react-mcp-server/src/index.ts#L376C1-L441C94))



&nbsp; ### Role



&nbsp; You are a React assistant that helps users write more efficient and optimizable React code. You specialize

&nbsp; in identifying patterns that enable React Compiler to automatically apply optimizations, reducing

&nbsp; unnecessary re-renders and improving application performance.



&nbsp; ### Follow these guidelines in all code you produce and suggest



&nbsp; Use functional components with Hooks: Do not generate class components or use old lifecycle methods. Manage

&nbsp; state with useState or useReducer, and side effects with useEffect (or related Hooks). Always prefer

&nbsp; functions and Hooks for any new component logic.



&nbsp; Keep components pure and side-effect-free during rendering: Do not produce code that performs side effects

&nbsp; (like subscriptions, network requests, or modifying external variables) directly inside the component's

&nbsp; function body. Such actions should be wrapped in useEffect or performed in event handlers. Ensure your

&nbsp; render logic is a pure function of props and state.



&nbsp; Respect one-way data flow: Pass data down through props and avoid any global mutations. If two components

&nbsp; need to share data, lift that state up to a common parent or use React Context, rather than trying to sync

&nbsp; local state or use external variables.



&nbsp; Never mutate state directly: Always generate code that updates state immutably. For example, use spread

&nbsp; syntax or other methods to create new objects/arrays when updating state. Do not use assignments like

&nbsp; state.someValue = ... or array mutations like array.push() on state variables. Use the state setter

&nbsp; (setState from useState, etc.) to update state.



&nbsp; Accurately use useEffect and other effect Hooks: whenever you think you could useEffect, think and reason

&nbsp; harder to avoid it. useEffect is primarily only used for synchronization, for example synchronizing React

&nbsp; with some external state. IMPORTANT - Don't setState (the 2nd value returned by useState) within a useEffect

&nbsp;  as that will degrade performance. When writing effects, include all necessary dependencies in the

&nbsp; dependency array. Do not suppress ESLint rules or omit dependencies that the effect's code uses. Structure

&nbsp; the effect callbacks to handle changing values properly (e.g., update subscriptions on prop changes, clean

&nbsp; up on unmount or dependency change). If a piece of logic should only run in response to a user action (like

&nbsp; a form submission or button click), put that logic in an event handler, not in a useEffect. Where possible,

&nbsp; useEffects should return a cleanup function.



&nbsp; Follow the Rules of Hooks: Ensure that any Hooks (useState, useEffect, useContext, custom Hooks, etc.) are

&nbsp; called unconditionally at the top level of React function components or other Hooks. Do not generate code

&nbsp; that calls Hooks inside loops, conditional statements, or nested helper functions. Do not call Hooks in

&nbsp; non-component functions or outside the React component rendering context.



&nbsp; Use refs only when necessary: Avoid using useRef unless the task genuinely requires it (such as focusing a

&nbsp; control, managing an animation, or integrating with a non-React library). Do not use refs to store

&nbsp; application state that should be reactive. If you do use refs, never write to or read from ref.current

&nbsp; during the rendering of a component (except for initial setup like lazy initialization). Any ref usage

&nbsp; should not affect the rendered output directly.



&nbsp; Prefer composition and small components: Break down UI into small, reusable components rather than writing

&nbsp; large monolithic components. The code you generate should promote clarity and reusability by composing

&nbsp; components together. Similarly, abstract repetitive logic into custom Hooks when appropriate to avoid

&nbsp; duplicating code.



&nbsp; Optimize for concurrency: Assume React may render your components multiple times for scheduling purposes

&nbsp; (especially in development with Strict Mode). Write code that remains correct even if the component function

&nbsp;  runs more than once. For instance, avoid side effects in the component body and use functional state

&nbsp; updates (e.g., setCount(c => c + 1)) when updating state based on previous state to prevent race conditions.

&nbsp;  Always include cleanup functions in effects that subscribe to external resources. Don't write useEffects

&nbsp; for "do this when this changes" side effects. This ensures your generated code will work with React's

&nbsp; concurrent rendering features without issues.



&nbsp; Optimize to reduce network waterfalls - Use parallel data fetching wherever possible (e.g., start multiple

&nbsp; requests at once rather than one after another). Leverage Suspense for data loading and keep requests

&nbsp; co-located with the component that needs the data. In a server-centric approach, fetch related data together

&nbsp;  in a single request on the server side (using Server Components, for example) to reduce round trips. Also,

&nbsp; consider using caching layers or global fetch management to avoid repeating identical requests.



&nbsp; Rely on React Compiler - useMemo, useCallback, and React.memo can be omitted if React Compiler is enabled.

&nbsp; Avoid premature optimization with manual memoization. Instead, focus on writing clear, simple components

&nbsp; with direct data flow and side-effect-free render functions. Let the React Compiler handle tree-shaking,

&nbsp; inlining, and other performance enhancements to keep your code base simpler and more maintainable.



&nbsp; Design for a good user experience - Provide clear, minimal, and non-blocking UI states. When data is

&nbsp; loading, show lightweight placeholders (e.g., skeleton screens) rather than intrusive spinners everywhere.

&nbsp; Handle errors gracefully with a dedicated error boundary or a friendly inline message. Where possible,

&nbsp; render partial data as it becomes available rather than making the user wait for everything. Suspense allows

&nbsp;  you to declare the loading states in your component tree in a natural way, preventing “flash” states and

&nbsp; improving perceived performance.



&nbsp; ### Process



&nbsp; 1. Analyze the user's code for optimization opportunities:

&nbsp;    - Check for React anti-patterns that prevent compiler optimization

&nbsp;    - Look for component structure issues that limit compiler effectiveness

&nbsp;    - Think about each suggestion you are making and consult React docs for best practices



&nbsp; 2. Provide actionable guidance:

&nbsp;    - Explain specific code changes with clear reasoning

&nbsp;    - Show before/after examples when suggesting changes

&nbsp;    - Only suggest changes that meaningfully improve optimization potential



&nbsp; ### Optimization Guidelines



&nbsp; - State updates should be structured to enable granular updates

&nbsp; - Side effects should be isolated and dependencies clearly defined



&nbsp; ## Comments policy



&nbsp; Only write high-value comments if at all. Avoid talking to the user through comments.



&nbsp; ## General style requirements



&nbsp; Use hyphens instead of underscores in flag names (e.g. my-flag instead of my\_flag).

&nbsp; --- End of Context from: \_br\_core\\GEMINI.md ---

&nbsp; ---

Rendben, a napi kutatási ciklus lezajlott. A mai jelentés a tegnapi témára – az ügynökök memóriájára – építve egy újabb kritikus képességet, a külső eszközök használatát vizsgálja, amely elengedhetetlen a valós világgal való interakcióhoz.
(Mielőtt belekezdenék, jelzem, hogy továbbra is várom a korábban említett Gemini beszélgetés tartalmát, ha azt továbbra is relevánsnak ítéli. Amint megkapom, azt is elemzem és beépítem a folyamatba.)
________________________________________
Kutató Ügynök Napi Jelentés: 2025. augusztus 12.

Tárgy: MI Ügynökök Felruházása Eszközökkel (Tools) a Valós Idejű Interakcióért és Adatfeldolgozásért
Egy ügynök, amely rendelkezik memóriával, de nem képes interakcióba lépni a külvilággal (fájlokat olvasni, weboldalakat elérni, API-kat hívni), csupán egy zárt rendszerben képes gondolkodni. A valódi produktivitás-növekedés akkor érhető el, ha az ügynökeink képesek aktívan cselekedni és adatokat gyűjteni a környezetükből.

1. Legújabb Trendek és Változások: Natív Funkcióhívás (Function Calling)

A legmeghatározóbb trend a modern nyelvi modellek, különösen a Gemini esetében, a natív funkcióhívás képessége. Ez azt jelenti, hogy a modell nem csupán szöveget generál, hanem képes felismerni, ha egy felhasználói kérés végrehajtásához egy külső programkód (egy "eszköz") futtatására van szükség. Ilyenkor a modell egy strukturált kérést ad vissza, amelyben pontosan megmondja, melyik funkciót és milyen paraméterekkel kell meghívni.
●	Miért releváns ez a csapatuk számára?
○	Automatizáció új szinten: Az ügynökök már nem csak javaslatokat tesznek, hanem végre is hajtják a feladatokat. Például egy " riportkészítő" ügynök képes önállóan lekérdezni a cég belső adatbázisát, beolvasni egy CSV fájlt, és az eredmények alapján generálni a riportot.
○	Valós idejű adatok: Az ügynökök hozzáférhetnek a legfrissebb információkhoz webes kereső eszközökön vagy API-hívásokon keresztül (pl. tőzsdei árfolyamok, időjárás-jelentés, legfrissebb hírek).
○	Korlátlan bővíthetőség: Bármilyen belső vagy külső folyamat integrálható egyedi eszközök fejlesztésével, így az ügynökök képességei szinte korlátlanul bővíthetők.

2. Legjobb CLI Eszköz/Technika: Egyedi Eszközök Készítése (@tool dekorátor)

Az ügynöki keretrendszerek (mint a tegnap tárgyalt CrewAI) lehetővé teszik, hogy egyszerű Python függvényeket "eszközként" adjunk át az ügynököknek. Ennek legelterjedtebb módja a LangChain könyvtárból származó @tool dekorátor használata.
●	Telepítés (ha még nem történt meg):
Bash
pip install langchain-community

●	Főbb Funkciók és Működés:
A @tool dekorátor egy Python függvény fölé helyezve jelzi az ügynöki rendszer számára, hogy ez a függvény egy használható eszköz. A varázslat a függvény docstring-jében (a """...""" közötti leíró szövegben) rejlik. Az LLM ezt a leírást olvassa el, hogy megértse:
1.	Mire való az eszköz?
2.	Milyen bemeneti paramétereket (argumentumokat) vár?
3.	Mikor érdemes használni?
●	Ajánlott Workflow (Fájlolvasó Eszköz Készítése):
1.	A Szükséglet Azonosítása: A csapatnak gyakran kell helyi fájlokban lévő szövegeket elemeznie.
2.	A Függvény Megírása: Készítünk egy egyszerű Python függvényt, ami beolvassa egy fájl tartalmát.
3.	Dekorálás és Dokumentálás: A függvény fölé helyezzük a @tool-t, és írunk egy egyértelmű docstring-et.
Python
from langchain.tools import tool

@tool
def file_reader_tool(file_path: str) -> str:
    """Használd ezt az eszközt egy szöveges fájl tartalmának beolvasására.
    A bemenete a fájl elérési útja."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Hiba a fájl olvasása közben: {e}"

4.	Hozzárendelés az Ügynökhöz: A CrewAI-ban az ügynök létrehozásakor a tools listában átadjuk neki ezt az új eszközt.
5.	Feladat Kiadása: Olyan feladatot adunk az ügynöknek, amely egyértelműen igényli a fájl olvasását: "Olvasd el a ./projekt/specifikacio.txt fájlt és foglald össze a 3 legfontosabb követelményt." Az ügynök a prompt és a tool leírása alapján tudni fogja, hogy meg kell hívnia a file_reader_tool funkciót a megadott elérési úttal.

3. Gemini-specifikus Újdonságok és Tippek

A Gemini modellcsalád kiemelkedően teljesít az eszközhasználat terén.
●	Párhuzamos Funkcióhívás (Parallel Function Calling): A legújabb Gemini modellek egyik legütősebb képessége, hogy egyetlen felhasználói kérésből képesek több, egymástól független eszközhívást is azonosítani és párhuzamosan kezdeményezni. Ha a prompt ez: "Milyen az időjárás Budapesten és mennyi a Google részvényeinek árfolyama?", a modell egyszerre adhatja ki a get_weather(city='Budapest') és a get_stock_price(ticker='GOOGL') hívásokat. Ez drámaian felgyorsítja a komplex, több forrásból dolgozó feladatok végrehajtását.
●	Megbízhatóság: A Gemini modelleket alapjaiktól kezdve a funkcióhívásra tervezték, így rendkívül pontosan és megbízhatóan választják ki a megfelelő eszközt és töltik ki annak paramétereit, csökkentve a hibás hívások esélyét.

4. Ajánlott Oktatási Prompt a Csapatnak (Brunellának)

Ezzel a prompttal egy "Mentor" ügynököt hozhattok létre, amely gyakorlatiasan tanítja meg a csapatot az egyedi eszközök készítésére.
Prompt:



Te egy senior MI mérnök vagy, aki a `CrewAI` keretrendszerre és a Gemini modellek képességeire specializálódott. A feladatod, hogy lépésről lépésre, egy komplett és futtatható Python szkripten keresztül mutasd be, hogyan kell egy egyedi eszközt (custom tool) létrehozni és azt egy ügynökhöz rendelni.

Az oktatóanyag a következőket tartalmazza:
1.  **A Cél:** Magyarázd el röviden, miért fontos, hogy az ügynökök eszközöket használjanak.
2.  **Az Eszköz:** A példa eszköz legyen egy 'Weboldal Összefoglaló'. Ez kapjon egy URL-t, töltse le a tartalmát (használd a `requests` és `beautifulsoup4` csomagokat a tiszta szöveg kinyeréséhez), és adja vissza az első 500 karaktert.
3.  **A Kód:**
    -   Mutasd be a szükséges telepítéseket (`pip install crewai crewai-tools requests beautifulsoup4 langchain-community`).
    -   Írd meg a `website_summary_tool` Python függvényt, a `@tool` dekorátorral és egy részletes, magyar nyelvű docstring-gel.
    -   Hozd létre a `CrewAI` "Kutató" ügynököt, és rendeld hozzá ezt az egyetlen eszközt.
    -   Definiálj egy feladatot (Task), amely arra utasítja az ügynököt, hogy használja az eszközt egy konkrét weboldal (pl. "https://www.origo.hu") összefoglalására.
    -   Fűzd össze az ügynököt és a feladatot egy `Crew`-ba, majd futtasd le.
4.  **Magyarázat:** A kód minden logikai egységét (eszközdefiníció, ügynök létrehozása, feladatkiadás) kommentáld részletesen, hogy a kezdők számára is érthető legyen a működés.

________________________________________A mai kutatási jelentést lezártam. Az eszközhasználat elsajátítása az a pont, ahol az MI ügynökök elméleti asszisztensekből gyakorlati, cselekvő partnerekké válnak.
Holnap reggel várom a jelzését a folytatáshoz.

Projekt Összegzés: Qwen3-Coder Integráció
1. Célkitűzés
A projekt célja a gemini-cli parancssori eszköz stratégiai továbbfejlesztése volt. A feladat a Qwen3-Coder, egy csúcskategóriás, nyílt forráskódú, kódolásra specializálódott MI modell integrálása volt, különös tekintettel annak "ágens" (agentic) képességeire. A végső cél egy olyan platform létrehozása volt, amely képes több MI modellt kezelni és autonóm, több lépésből álló feladatokat végrehajtani.
2. Végrehajtási Folyamat
A fejlesztést egy előre meghatározott, négyfázisú terv mentén hajtottuk végre a minőség és a strukturált haladás érdekében.
1. Fázis: Alapozás és Konfiguráció
●	Konfigurációs Séma: Kibővítettük a konfigurációs rendszert, hogy támogassa több API szolgáltató (Gemini, Qwen) beállításait.
●	API Kliens Absztrakció: Létrehoztunk egy LanguageModelClient interfészt, amely elválasztja a központi logikát a konkrét modell implementációktól, ezzel biztosítva a jövőbeli bővíthetőséget.
2. Fázis: Ágens Működési Logika (Agentic Loop)
●	Iteratív Eszközkezelő: A CoreToolScheduler-t átalakítottuk egy "ágens hurokká", amely képes ciklikusan futtatni a modell által kért eszközöket és feldolgozni azok eredményeit, amíg a feladat teljesen meg nem oldódik.
●	Felhasználói Felület Előkészítése: A useToolScheduler hookot felkészítettük a több lépésből álló folyamatok állapotának követésére és megjelenítésére.
3. Fázis: Qwen-Specifikus Optimalizáció
●	Kliens Implementáció: Befejeztük a QwenClient osztályt, amely képes kommunikálni az OpenAI-kompatibilis API-kkal, és elvégzi a szükséges adattranszformációkat.
●	Prompt Engineering: Dedikált rendszer-promptokat hoztunk létre a Qwen3-Coder számára, amelyek hatékonyan instruálják az "ágens" viselkedésre.
4. Fázis: Tesztelés és Finomítás
●	Integrációs Teszt: Létrehoztunk egy átfogó tesztet, amely egy valós, több lépésből álló forgatókönyvet szimulál (fájlok listázása, majd tartalom olvasása), ezzel igazolva az új architektúra megbízhatóságát.
3. Eredmény
A projekt sikeresen lezárult. A gemini-cli egy továbbfejlesztett, rugalmas platformmá vált, amely:
●	Több modellt támogat: Képes párhuzamosan kezelni a Gemini és a Qwen3-Coder modelleket.
●	"Ágens" képességekkel rendelkezik: Az új architektúra lehetővé teszi komplex, iteratív feladatok végrehajtását.
●	Jövőbiztos: Az absztrakt felépítésnek köszönhetően könnyen bővíthető új modellekkel és eszközökkel.
Ez a fejlesztés stratégiai előrelépést jelent a gemini-cli számára, meghaladva az egyszerű parancs-válasz interakciókat.

------

A Gemini CLI számos beépített parancsot támogat, amelyek segítenek a munkamenet kezelésében, a felület testreszabásában és a viselkedésének szabályozásában. Ezek a parancsok perjel ( /), kukac ( @) vagy felkiáltójel ( !) előtaggal rendelkeznek.

Perjel parancsok ( /)
A perjel parancsok metaszintű vezérlést biztosítanak a parancssori felület (CLI) felett.

Beépített parancsok
/bug

Leírás: Hiba bejelentése a Gemini CLI-vel kapcsolatban. Alapértelmezés szerint a probléma a Gemini CLI GitHub repository-jában kerül bejelentésre. Az ezután beírt karakterlánc /buglesz a bejelentett hiba címsora. Az alapértelmezett /bugviselkedés módosítható a advanced.bugCommandfájlokban található beállításokkal .gemini/settings.json.
/chat

Leírás: Beszélgetési előzmények mentése és folytatása elágazó beszélgetési állapotokhoz interaktívan, vagy egy korábbi állapot folytatása egy későbbi munkamenetből.
Alparancsok:
save
Leírás: Menti az aktuális beszélgetési előzményeket. Hozzá kell adnia egyet <tag>a beszélgetés állapotának azonosítására.
Használat: /chat save <tag>
Az ellenőrzőpontok helyének részletei: A mentett csevegési ellenőrzőpontok alapértelmezett helyei a következők:
Linux/macOS:~/.gemini/tmp/<project_hash>/
Ablakok:C:\Users\<YourUsername>\.gemini\tmp\<project_hash>\
A futtatásakor /chat lista parancssor (CLI) csak ezeket a konkrét könyvtárakat vizsgálja át az elérhető ellenőrzőpontok megtalálásához.
Megjegyzés: Ezek az ellenőrzőpontok a beszélgetési állapotok manuális mentésére és folytatására szolgálnak. A fájlmódosítások előtt létrehozott automatikus ellenőrzőpontokkal kapcsolatban lásd az Ellenőrzőpontok dokumentációját .
resume
Leírás: Folytatja a beszélgetést egy korábbi mentésből.
Használat: /chat resume <tag>
list
Leírás: Felsorolja az elérhető címkéket a csevegési állapot folytatásához.
delete
Leírás: Törli a mentett beszélgetési ellenőrzőpontot.
Használat: /chat delete <tag>
share
Leírás Az aktuális beszélgetést egy megadott Markdown vagy JSON fájlba írja.
Használat /chat share file.md vagy /chat share file.json. Ha nincs megadva fájlnév, akkor a parancssori felület generál egyet.
/clear

Leírás: Törli a terminálképernyőt, beleértve a látható munkamenet-előzményeket és a parancssori felületen belüli visszagörgetést is. Az alapul szolgáló munkamenet-adatok (az előzmények visszakereséséhez) a pontos implementációtól függően megmaradhatnak, de a vizuális megjelenítés törlődik.
Billentyűparancs: Nyomja meg a Ctrl+L billentyűkombinációt bármikor egy művelet végrehajtásához.
/compress

Leírás: A teljes csevegési kontextus lecserélése egy összefoglalóra. Ez a jövőbeni feladatokhoz felhasznált tokenek számát takarítja meg, miközben megőrzi a történtek magas szintű összefoglalását.
/copy

Leírás: A Gemini CLI által legutóbb létrehozott kimenetet a vágólapra másolja az egyszerű megosztás vagy újrafelhasználás érdekében.
Megjegyzés: Ehhez a parancshoz platformspecifikus vágólapeszközök telepítése szükséges.
Linux rendszeren xclipvagy szükséges hozzá xsel. Általában a rendszer csomagkezelőjével telepítheted őket.
macOS rendszeren a szükséges pbcopy, Windows rendszeren pedig a szükséges clip. Ezek az eszközök általában előre telepítve vannak a megfelelő rendszereken.
/directory(vagy /dir)

Leírás: Munkaterület-könyvtárak kezelése több könyvtár támogatásához.
Alparancsok:
add:
Leírás: Könyvtár hozzáadása a munkaterülethez. Az elérési út lehet abszolút vagy relatív az aktuális munkakönyvtárhoz képest. Ezenkívül a saját könyvtárból való hivatkozás is támogatott.
Használat: /directory add <path1>,<path2>
Megjegyzés: Letiltva van a korlátozó sandbox profilokban. Ha azt használja, akkor --include-directoriesa munkamenet indításakor használja.
show:
Leírás:/directory add Megjeleníti az és által hozzáadott összes könyvtárat --include-directories.
Használat: /directory show
/editor

Leírás: Megnyit egy párbeszédpanelt a támogatott szerkesztők kiválasztásához.
/extensions

Leírás: Felsorolja az aktuális Gemini CLI munkamenetben aktív összes kiterjesztést. Lásd: Gemini CLI kiterjesztések .
/help(vagy /?)

Leírás: Súgóinformációk megjelenítése a Gemini CLI-ről, beleértve az elérhető parancsokat és azok használatát.
/mcp

Leírás: Felsorolja a konfigurált Model Context Protocol (MCP) szervereket, azok kapcsolati állapotát, a szerver részleteit és az elérhető eszközöket.
Alparancsok:
descvagy descriptions:
Leírás: Az MCP-kiszolgálók és -eszközök részletes leírásainak megjelenítése.
nodescvagy nodescriptions:
Leírás: Eszközleírások elrejtése, csak az eszközök neveinek megjelenítése.
schema:
Leírás: Megjeleníti az eszköz konfigurált paramétereinek teljes JSON-sémáját.
Billentyűparancs: A Ctrl+T billentyűkombinációval bármikor válthat az eszközleírások megjelenítése és elrejtése között.
/memory

Leírás: A mesterséges intelligencia utasításkörnyezetének kezelése ( GEMINI.mdfájlokból betöltött hierarchikus memória).
Alparancsok:
add:
Leírás: A következő szöveget adja hozzá a mesterséges intelligencia memóriájához. Használat: /memory add <text to remember>
show:
Leírás: Megjeleníti az aktuális hierarchikus memória teljes, összefűzött tartalmát, amelyet az összes fájlból töltöttek be GEMINI.md. Ez lehetővé teszi a Gemini modellnek biztosított utasítási kontextus vizsgálatát.
refresh:
Leírás: A hierarchikus utasításmemória újratöltése GEMINI.mda konfigurált helyeken (globális, projekt/őskönyvtárak és alkönyvtárak) található összes fájlból. Ez a parancs frissíti a modellt a legújabb GEMINI.mdtartalommal.
list:
Leírás: Felsorolja a hierarchikus memóriában használt GEMINI.md fájlok elérési útját.
Megjegyzés:GEMINI.md A fájlok hierarchikus memóriához való hozzájárulásával kapcsolatos további részletekért lásd a CLI konfigurációs dokumentációját .
/restore

Leírás: Visszaállítja a projektfájlokat abba az állapotba, amelyben közvetlenül egy eszköz futtatása előtt voltak. Ez különösen hasznos az eszköz által végrehajtott fájlszerkesztések visszavonásához. Ha eszközhívási azonosító nélkül futtatja, akkor felsorolja a visszaállításhoz rendelkezésre álló ellenőrzőpontokat.
Használat: /restore [tool_call_id]
Megjegyzés: Csak akkor érhető el, ha a parancssori felületet a beállítással hívják meg , vagy a beállításokon--checkpointing keresztül konfigurálják . További részletekért lásd az ellenőrzőpontok dokumentációját .
/settings

Leírás: Nyissa meg a beállításszerkesztőt a Gemini CLI beállításainak megtekintéséhez és módosításához.
Részletek: Ez a parancs felhasználóbarát felületet biztosít a Gemini CLI viselkedését és megjelenését szabályozó beállítások módosításához. Ez egyenértékű a .gemini/settings.jsonfájl manuális szerkesztésével, de érvényesítéssel és útmutatással a hibák elkerülése érdekében.
Használat: Egyszerűen futtassa /settings, és a szerkesztő megnyílik. Ezután böngészhet vagy kereshet adott beállításokat, megtekintheti azok aktuális értékét, és igény szerint módosíthatja azokat. Egyes beállítások módosításai azonnal érvénybe lépnek, míg mások újraindítást igényelnek.
/stats

Leírás: Részletes statisztikákat jelenít meg az aktuális Gemini CLI munkamenetről, beleértve a tokenhasználatot, a gyorsítótárazott tokenmegtakarításokat (ha elérhető) és a munkamenet időtartamát. Megjegyzés: A gyorsítótárazott tokeninformációk csak akkor jelennek meg, ha gyorsítótárazott tokeneket használnak, ami API-kulcsos hitelesítéssel történik, de jelenleg nem OAuth hitelesítéssel.
/theme

Leírás: Megnyit egy párbeszédpanelt, amely lehetővé teszi a Gemini CLI vizuális témájának módosítását.
/auth

Leírás: Megnyit egy párbeszédpanelt, amelyen módosíthatja a hitelesítési módszert.
/about

Leírás: Verzióinformációk megjelenítése. Kérjük, ossza meg ezt az információt a problémák bejelentésekor.
/tools

Leírás: Megjeleníti a Gemini CLI-n belül jelenleg elérhető eszközök listáját.
Használat: /tools [desc]
Alparancsok:
descvagy descriptions:
Leírás: Részletes leírást jelenítsen meg az egyes eszközökről, beleértve az egyes eszközök nevét és a modellnek megadott teljes leírását.
nodescvagy nodescriptions:
Leírás: Eszközleírások elrejtése, csak az eszközök neveinek megjelenítése.
/privacy

Leírás: Jelenítse meg az Adatvédelmi nyilatkozatot, és tegye lehetővé a felhasználók számára, hogy kiválasszák, hozzájárulnak-e adataik gyűjtéséhez a szolgáltatásfejlesztés céljából.
/quit(vagy /exit)

Leírás: Lépjen ki a Gemini parancssori felületéről.
/vim

Leírás: A vim mód be- és kikapcsolása. Ha a vim mód engedélyezve van, a beviteli terület támogatja a vim stílusú navigációt és szerkesztési parancsokat mind NORMAL, mind INSERT módban.
Jellemzők:
NORMÁL mód: Navigálás a h, j, k, l; ugrás szavakonként a w, b, e; sor elejére/végére ugrás a 0, $, ^; adott sorokra ugrás a G(vagy ggaz első sor esetén) gombbal.
INSERT mód: Normál szövegbevitel, Escape billentyűvel a NORMÁL módba való visszatéréshez
Szerkesztőparancsok: Törlés xa , módosítás a c, beszúrás ia , a, o, O; összetett műveletek, mint például dda cc, , dw,cw
Számlálás támogatása: A parancsok elé számokat írjon (pl. 3h, 5w, 10G)
Utolsó parancs ismétlése: Használja .az utolsó szerkesztési művelet megismétléséhez
Állandó beállítás: A Vim mód beállításai mentésre kerülnek, ~/.gemini/settings.jsonés a munkamenetek között visszaállnak.
Állapotjelző: Ha engedélyezve van, a láblécben a [NORMAL]vagy a ikon látható.[INSERT]
/init

Leírás: A fájlok egyszerű létrehozásának megkönnyítése érdekében GEMINI.mdez a parancs elemzi az aktuális könyvtárat, és létrehoz egy testreszabott kontextusfájlt, így egyszerűbbé téve a felhasználók számára a projektspecifikus utasítások megadását a Gemini ügynöknek.
Egyéni parancsok
Az egyéni parancsok lehetővé teszik személyre szabott gyorsbillentyűk létrehozását a leggyakrabban használt promptokhoz. A létrehozásukkal, kezelésükkel és használatukkal kapcsolatos részletes utasításokért tekintse meg az Egyéni parancsok dokumentációját .

Beviteli parancsok billentyűparancsai
Ezek a billentyűparancsok közvetlenül a szövegszerkesztéshez használt beviteli promptra vonatkoznak.

Visszavonás:

Billentyűparancs: Nyomja meg a Ctrl+z billentyűkombinációt a beviteli mező utolsó műveletének visszavonásához.
Újra:

Billentyűparancs: Nyomja meg a Ctrl+Shift+Z billentyűkombinációt a beviteli mezőben utoljára visszavont művelet újbóli végrehajtásához.
Parancsoknál ( @)
Az at parancsokat arra használjuk, hogy fájlok vagy könyvtárak tartalmát belefoglaljuk a Gemininek küldött prompt részeként. Ezek a parancsok git-tudatos szűrést tartalmaznak.

@<path_to_file_or_directory>

Leírás: A megadott fájl vagy fájlok tartalmának beillesztése az aktuális promptba. Ez hasznos adott kóddal, szöveggel vagy fájlgyűjteményekkel kapcsolatos kérdések esetén.
Példák:
@path/to/your/file.txt Explain this text.
@src/my_project/ Summarize the code in this directory.
What is this file about? @README.md
Részletek:
Ha egyetlen fájl elérési útja van megadva, akkor a fájl tartalma kerül beolvasásra.
Ha meg van adva egy könyvtár elérési útja, a parancs megpróbálja beolvasni az adott könyvtárban és az alkönyvtárakban található fájlok tartalmát.
Az elérési utakban a szóközöket fordított perjellel (pl. @My\ Documents/file.txt) kell elválasztani.
A parancs belsőleg használja az read_many_fileseszközt. A tartalom lekérésre kerül, majd beillesztésre kerül a lekérdezésbe, mielőtt elküldené a Gemini modellnek.
Git-tudatos szűrés: Alapértelmezés szerint a git által figyelmen kívül hagyott fájlok (mint például node_modules/a , dist/, .env, .git/) kizárásra kerülnek. Ez a viselkedés a beállításokon keresztül módosítható context.fileFiltering.
Fájltípusok: A parancs szöveges fájlokhoz készült. Bár megpróbálhat bármilyen fájlt beolvasni, a bináris fájlokat vagy a nagyon nagy fájlokat az alapul szolgáló read_many_fileseszköz kihagyhatja vagy csonkolhatja a teljesítmény és a relevancia biztosítása érdekében. Az eszköz jelzi, ha a fájlok kimaradtak.
Kimenet: A parancssori felület egy eszközhívási üzenetet jelenít meg, amely jelzi, hogy a read_many_filesműveletet használták, valamint egy üzenetet, amely részletezi az állapotot és a feldolgozott útvonal(ak)at.
@(Magány a szimbólumnál)

Leírás: Ha elérési út nélkül ír be egy @szimbólumot, a lekérdezés változatlanul kerül átadásra a Gemini modellnek. Ez akkor lehet hasznos, ha kifejezetten a promptban szereplő szimbólumról beszél .@
@Parancsok hibakezelése
Ha a megadott elérési út @nem található vagy érvénytelen, hibaüzenet jelenik meg, és előfordulhat, hogy a lekérdezés nem kerül elküldésre a Gemini modellnek, vagy a fájl tartalma nélkül kerül elküldésre.
Ha az read_many_fileseszköz hibába ütközik (pl. jogosultsági problémák), akkor erről is jelentés készül.
Héjmód és áteresztő parancsok ( !)
Az !előtag lehetővé teszi, hogy közvetlenül a Gemini CLI-n belülről kommunikálj a rendszer shelljével.

!<shell_command>

Leírás:<shell_command> A megadott parancs végrehajtása bashLinux/macOS vagy powershell.exe -NoProfile -CommandWindows rendszeren (kivéve, ha felülírja a ComSpec). A parancs kimenete vagy hibái a terminálban jelennek meg.
Példák:
!ls -la(végrehajtás ls -laés visszatérés a Gemini parancssori felületére)
!git status(végrehajtás git statusés visszatérés a Gemini parancssori felületére)

A Gemini CLI mag ( packages/core) egy robusztus rendszert kínál az eszközök definiálására, regisztrálására és végrehajtására. Ezek az eszközök kibővítik a Gemini modell képességeit, lehetővé téve számára a helyi környezettel való interakciót, webes tartalom lekérését és az egyszerű szöveggeneráláson túlmutató különféle műveletek végrehajtását.

Alapfogalmak
Eszköz ( tools.ts): Egy interfész és alaposztály ( BaseTool), amely meghatározza az összes eszköz szerződését. Minden eszköznek rendelkeznie kell a következőkkel:

name: Egy egyedi belső név (a Gemini API-hívásaiban használatos).
displayNameFelhasználóbarát név.
description: Az eszköz működésének világos magyarázata, amelyet a Gemini modellnek biztosítanak.
parameterSchemaEgy JSON-séma, amely meghatározza az eszköz által elfogadott paramétereket. Ez kulcsfontosságú ahhoz, hogy a Gemini modell megértse, hogyan hívja meg helyesen az eszközt.
validateToolParams(): Egy módszer a bejövő paraméterek validálására.
getDescription(): Egy módszer, amely ember által olvasható leírást ad arról, hogy mit fog tenni az eszköz a megadott paraméterekkel a végrehajtás előtt.
shouldConfirmExecute(): Egy módszer annak meghatározására, hogy szükséges-e felhasználói megerősítés a végrehajtás előtt (pl. potenciálisan destruktív műveletek esetén).
execute(): Az eszköz műveletét végrehajtó és egy értéket visszaadó alapvető metódus ToolResult.
ToolResult( tools.ts): Egy eszköz végrehajtási eredményének szerkezetét meghatározó interfész:

llmContent: A tényszerű tartalom, amelyet a kontextus érdekében az LLM-nek visszaküldött előzményekben szerepeltetni kell. Ez lehet egy egyszerű karakterlánc vagy egy PartListUnion(objektumok és karakterláncok tömbje Part) gazdagabb tartalom esetén.
returnDisplay: Egy felhasználóbarát karakterlánc (gyakran Markdown) vagy egy speciális objektum (például FileDiff) a CLI-ben való megjelenítéshez.
Gazdag tartalom visszaadása: Az eszközök nem korlátozódnak egyszerű szöveg visszaadására. A llmContentlehet , amely egy tömb, és objektumok (képek, hangok stb.) és s PartListUnionkeverékét tartalmazhatja . Ez lehetővé teszi, hogy egyetlen eszközfuttatás több gazdag tartalom visszaadására szolgáljon.Partstring

Eszköznyilvántartás ( tool-registry.ts): Egy osztály ( ToolRegistry), amely a következőkért felelős:

Eszközök regisztrálása: Az összes elérhető beépített eszköz gyűjteményének tárolása (pl. ReadFileTool, ShellTool).
Eszközök felfedezése: Dinamikusan is képes eszközöket felfedezni:
Parancsalapú felderítés: Ha tools.discoveryCommanda beállításokban be van állítva, akkor a parancs végrehajtásra kerül. A parancsnak JSON formátumban kell kimenetet létrehoznia, amely leírja az egyéni eszközöket, amelyeket aztán DiscoveredTool példányként regisztrál a rendszer.
MCP-alapú felderítés: Ha mcp.serverCommandbe van állítva, a beállításjegyzék csatlakozhat egy Model Context Protocol (MCP) szerverhez az eszközök listázásához és regisztrálásához ( DiscoveredMCPTool).
Sémák biztosítása: Az FunctionDeclarationösszes regisztrált eszköz sémáinak elérhetővé tétele a Gemini modell számára, így az tudja, hogy milyen eszközök érhetők el és hogyan kell azokat használni.
Eszközök lekérése: Lehetővé teszi a mag számára, hogy név szerint lekérjen egy adott eszközt végrehajtáshoz.
Beépített eszközök
A mag előre definiált eszközökkel rendelkezik, amelyek jellemzően a címen találhatók packages/core/src/tools/. Ezek a következők:

Fájlrendszer eszközök:
LSTool( ls.ts): Felsorolja a könyvtár tartalmát.
ReadFileTool( read-file.ts): Egyetlen fájl tartalmát olvassa be. Egy absolute_pathparamétert fogad el, amelynek abszolút elérési utat kell megadnia.
WriteFileTool( write-file.ts): Tartalmat ír egy fájlba.
GrepTool( grep.ts): Fájlokban keres mintákat.
GlobTool( glob.ts): Glob mintáknak megfelelő fájlokat keres.
EditTool( edit.ts): Helyben módosítja a fájlokat (gyakran megerősítést igényel).
ReadManyFilesTool( read-many-files.ts): Több fájlból vagy glob mintából olvas be és fűz össze tartalmat (a parancs használja a @CLI-ben).
Végrehajtási eszközök:
ShellTool( shell.ts): Tetszőleges shell parancsokat hajt végre (gondos sandboxolást és felhasználói megerősítést igényel).
Webeszközök:
WebFetchTool( web-fetch.ts): Tartalmat kér le egy URL-címről.
WebSearchTool( web-search.ts): Webes keresést hajt végre.
Memóriaeszközök:
MemoryTool( memoryTool.ts): Kölcsönhatásba lép a mesterséges intelligencia memóriájával.
Ezen eszközök mindegyike kiterjeszti BaseToolés megvalósítja a szükséges metódusokat az adott funkcióhoz.

Eszköz végrehajtási folyamata
Modellkérés: A Gemini modell a felhasználó promptja és a megadott eszközsémák alapján eldönti, hogy használ-e egy eszközt, és FunctionCall válaszában egy részt ad vissza, megadva az eszköz nevét és argumentumait.
A mag kérést fogad: A mag elemzi ezt FunctionCall.
Szerszámlekérés: Megkeresi a kért szerszámot a mappában ToolRegistry.
Paraméterellenőrzés: Az eszköz validateToolParams()metódusa meghívódik.
Megerősítés (ha szükséges):
Az eszköz shouldConfirmExecute()metódusát nevezzük.
Ha megerősítést kérő adatokat ad vissza, a mag ezt visszaküldi a parancssori felületnek (CLI), amely felszólítja a felhasználót.
A felhasználó döntése (pl. folytatás, mégsem) visszakerül a magba.
Végrehajtás: Ha a metódus validálva és megerősítve van (vagy ha nincs szükség megerősítésre), a mag meghívja az eszköz execute()metódusát a megadott argumentumokkal és egy AbortSignal(esetleges megszakítás esetén) `tüntetéssel`.
Eredményfeldolgozás: A ToolResultfrom-ot execute()a mag fogadja.
Válasz a modellre: A llmContent-ból/-ből származó ToolResultegy ként van becsomagolva, FunctionResponseés visszaküldve a Gemini modellnek, hogy az továbbra is generálhasson egy felhasználó által látható választ.
Megjelenítés a felhasználónak: A a parancssori felületre küldi returnDisplaya jelet ToolResult, hogy megmutassa a felhasználónak, mit tett az eszköz.
Bővítés egyéni eszközökkel
Bár az új eszközök felhasználók általi közvetlen programozott regisztrációja nincs kifejezetten részletezve elsődleges munkafolyamatként a tipikus végfelhasználók számára biztosított fájlokban, az architektúra támogatja a kiterjesztést a következőkön keresztül:

Parancsalapú felderítés: A haladó felhasználók vagy a projektadminisztrátorok definiálhatnak egy tools.discoveryCommandin objektumot settings.json. Ennek a parancsnak, amikor a Gemini CLI mag futtatja, egy JSON objektumtömböt kell kimenetként megjelenítenie FunctionDeclaration . A mag ezután ezeket példányként elérhetővé teszi DiscoveredTool . A megfelelő tools.callCommandmag lesz felelős ezen egyéni eszközök tényleges végrehajtásáért.
MCP-kiszolgáló(k): Bonyolultabb forgatókönyvek esetén egy vagy több MCP-kiszolgáló beállítható és konfigurálható a mcpServersbeállításon keresztül settings.json. A Gemini CLI mag ezután képes felismerni és használni az ezen kiszolgálók által elérhető eszközöket. Ahogy említettük, ha több MCP-kiszolgálóval rendelkezik, az eszközök nevei a konfigurációból származó kiszolgálónévvel lesznek ellátva (pl. serverAlias__actualToolName).
Ez az eszközrendszer rugalmas és hatékony módot kínál a Gemini modell képességeinek bővítésére, így a Gemini CLI sokoldalú asszisztenssé válik a feladatok széles skálájához.


# Memory Import Processor

The Memory Import Processor is a feature that allows you to modularize your
GEMINI.md files by importing content from other files using the `@file.md`
syntax.

## Overview

This feature enables you to break down large GEMINI.md files into smaller, more
manageable components that can be reused across different contexts. The import
processor supports both relative and absolute paths, with built-in safety
features to prevent circular imports and ensure file access security.

## Syntax

Use the `@` symbol followed by the path to the file you want to import:

```markdown
# Main GEMINI.md file

This is the main content.

@./components/instructions.md

More content here.

@./shared/configuration.md
```

## Supported Path Formats

### Relative Paths

- `@./file.md` - Import from the same directory
- `@../file.md` - Import from parent directory
- `@./components/file.md` - Import from subdirectory

### Absolute Paths

- `@/absolute/path/to/file.md` - Import using absolute path

## Examples

### Basic Import

```markdown
# My GEMINI.md

Welcome to my project!

@./get-started.md

## Features

@./features/overview.md
```

### Nested Imports

The imported files can themselves contain imports, creating a nested structure:

```markdown
# main.md

@./header.md @./content.md @./footer.md
```

```markdown
# header.md

# Project Header

@./shared/title.md
```

## Safety Features

### Circular Import Detection

The processor automatically detects and prevents circular imports:

```markdown
# file-a.md

@./file-b.md

# file-b.md

@./file-a.md <!-- This will be detected and prevented -->
```

### File Access Security

The `validateImportPath` function ensures that imports are only allowed from
specified directories, preventing access to sensitive files outside the allowed
scope.

### Maximum Import Depth

To prevent infinite recursion, there's a configurable maximum import depth
(default: 5 levels).

## Error Handling

### Missing Files

If a referenced file doesn't exist, the import will fail gracefully with an
error comment in the output.

### File Access Errors

Permission issues or other file system errors are handled gracefully with
appropriate error messages.

## Code Region Detection

The import processor uses the `marked` library to detect code blocks and inline
code spans, ensuring that `@` imports inside these regions are properly ignored.
This provides robust handling of nested code blocks and complex Markdown
structures.

## Import Tree Structure

The processor returns an import tree that shows the hierarchy of imported files,
similar to Claude's `/memory` feature. This helps users debug problems with
their GEMINI.md files by showing which files were read and their import
relationships.

Example tree structure:

```
Memory Files
 L project: GEMINI.md
            L a.md
              L b.md
                L c.md
              L d.md
                L e.md
                  L f.md
            L included.md
```

The tree preserves the order that files were imported and shows the complete
import chain for debugging purposes.

## Comparison to Claude Code's `/memory` (`claude.md`) Approach

Claude Code's `/memory` feature (as seen in `claude.md`) produces a flat, linear
document by concatenating all included files, always marking file boundaries
with clear comments and path names. It does not explicitly present the import
hierarchy, but the LLM receives all file contents and paths, which is sufficient
for reconstructing the hierarchy if needed.

> [!NOTE] The import tree is mainly for clarity during development and has
> limited relevance to LLM consumption.

## API Reference

### `processImports(content, basePath, debugMode?, importState?)`

Processes import statements in GEMINI.md content.

**Parameters:**

- `content` (string): The content to process for imports
- `basePath` (string): The directory path where the current file is located
- `debugMode` (boolean, optional): Whether to enable debug logging (default:
  false)
- `importState` (ImportState, optional): State tracking for circular import
  prevention

**Returns:** Promise&lt;ProcessImportsResult&gt; - Object containing processed
content and import tree

### `ProcessImportsResult`

```typescript
interface ProcessImportsResult {
  content: string; // The processed content with imports resolved
  importTree: MemoryFile; // Tree structure showing the import hierarchy
}
```

### `MemoryFile`

```typescript
interface MemoryFile {
  path: string; // The file path
  imports?: MemoryFile[]; // Direct imports, in the order they were imported
}
```

### `validateImportPath(importPath, basePath, allowedDirectories)`

Validates import paths to ensure they are safe and within allowed directories.

**Parameters:**

- `importPath` (string): The import path to validate
- `basePath` (string): The base directory for resolving relative paths
- `allowedDirectories` (string[]): Array of allowed directory paths

**Returns:** boolean - Whether the import path is valid

### `findProjectRoot(startDir)`

Finds the project root by searching for a `.git` directory upwards from the
given start directory. Implemented as an **async** function using non-blocking
file system APIs to avoid blocking the Node.js event loop.

**Parameters:**

- `startDir` (string): The directory to start searching from

**Returns:** Promise&lt;string&gt; - The project root directory (or the start
directory if no `.git` is found)

## Best Practices

1. **Use descriptive file names** for imported components
2. **Keep imports shallow** - avoid deeply nested import chains
3. **Document your structure** - maintain a clear hierarchy of imported files
4. **Test your imports** - ensure all referenced files exist and are accessible
5. **Use relative paths** when possible for better portability

## Troubleshooting

### Common Issues

1. **Import not working**: Check that the file exists and the path is correct
2. **Circular import warnings**: Review your import structure for circular
   references
3. **Permission errors**: Ensure the files are readable and within allowed
   directories
4. **Path resolution issues**: Use absolute paths if relative paths aren't
   resolving correctly

### Debug Mode

Enable debug mode to see detailed logging of the import process:

```typescript
const result = await processImports(content, basePath, true);
```

# MCP servers with the Gemini CLI

This document provides a guide to configuring and using Model Context Protocol
(MCP) servers with the Gemini CLI.

## What is an MCP server?

An MCP server is an application that exposes tools and resources to the Gemini
CLI through the Model Context Protocol, allowing it to interact with external
systems and data sources. MCP servers act as a bridge between the Gemini model
and your local environment or other services like APIs.

An MCP server enables the Gemini CLI to:

- **Discover tools:** List available tools, their descriptions, and parameters
  through standardized schema definitions.
- **Execute tools:** Call specific tools with defined arguments and receive
  structured responses.
- **Access resources:** Read data from specific resources (though the Gemini CLI
  primarily focuses on tool execution).

With an MCP server, you can extend the Gemini CLI's capabilities to perform
actions beyond its built-in features, such as interacting with databases, APIs,
custom scripts, or specialized workflows.

## Core Integration Architecture

The Gemini CLI integrates with MCP servers through a sophisticated discovery and
execution system built into the core package (`packages/core/src/tools/`):

### Discovery Layer (`mcp-client.ts`)

The discovery process is orchestrated by `discoverMcpTools()`, which:

1. **Iterates through configured servers** from your `settings.json`
   `mcpServers` configuration
2. **Establishes connections** using appropriate transport mechanisms (Stdio,
   SSE, or Streamable HTTP)
3. **Fetches tool definitions** from each server using the MCP protocol
4. **Sanitizes and validates** tool schemas for compatibility with the Gemini
   API
5. **Registers tools** in the global tool registry with conflict resolution

### Execution Layer (`mcp-tool.ts`)

Each discovered MCP tool is wrapped in a `DiscoveredMCPTool` instance that:

- **Handles confirmation logic** based on server trust settings and user
  preferences
- **Manages tool execution** by calling the MCP server with proper parameters
- **Processes responses** for both the LLM context and user display
- **Maintains connection state** and handles timeouts

### Transport Mechanisms

The Gemini CLI supports three MCP transport types:

- **Stdio Transport:** Spawns a subprocess and communicates via stdin/stdout
- **SSE Transport:** Connects to Server-Sent Events endpoints
- **Streamable HTTP Transport:** Uses HTTP streaming for communication

## How to set up your MCP server

The Gemini CLI uses the `mcpServers` configuration in your `settings.json` file
to locate and connect to MCP servers. This configuration supports multiple
servers with different transport mechanisms.

### Configure the MCP server in settings.json

You can configure MCP servers in your `settings.json` file in two main ways:
through the top-level `mcpServers` object for specific server definitions, and
through the `mcp` object for global settings that control server discovery and
execution.

#### Global MCP Settings (`mcp`)

The `mcp` object in your `settings.json` allows you to define global rules for
all MCP servers.

- **`mcp.serverCommand`** (string): A global command to start an MCP server.
- **`mcp.allowed`** (array of strings): A list of MCP server names to allow. If
  this is set, only servers from this list (matching the keys in the
  `mcpServers` object) will be connected to.
- **`mcp.excluded`** (array of strings): A list of MCP server names to exclude.
  Servers in this list will not be connected to.

**Example:**

```json
{
  "mcp": {
    "allowed": ["my-trusted-server"],
    "excluded": ["experimental-server"]
  }
}
```

#### Server-Specific Configuration (`mcpServers`)

The `mcpServers` object is where you define each individual MCP server you want
the CLI to connect to.

### Configuration Structure

Add an `mcpServers` object to your `settings.json` file:

```json
{ ...file contains other config objects
  "mcpServers": {
    "serverName": {
      "command": "path/to/server",
      "args": ["--arg1", "value1"],
      "env": {
        "API_KEY": "$MY_API_TOKEN"
      },
      "cwd": "./server-directory",
      "timeout": 30000,
      "trust": false
    }
  }
}
```

### Configuration Properties

Each server configuration supports the following properties:

#### Required (one of the following)

- **`command`** (string): Path to the executable for Stdio transport
- **`url`** (string): SSE endpoint URL (e.g., `"http://localhost:8080/sse"`)
- **`httpUrl`** (string): HTTP streaming endpoint URL

#### Optional

- **`args`** (string[]): Command-line arguments for Stdio transport
- **`headers`** (object): Custom HTTP headers when using `url` or `httpUrl`
- **`env`** (object): Environment variables for the server process. Values can
  reference environment variables using `$VAR_NAME` or `${VAR_NAME}` syntax
- **`cwd`** (string): Working directory for Stdio transport
- **`timeout`** (number): Request timeout in milliseconds (default: 600,000ms =
  10 minutes)
- **`trust`** (boolean): When `true`, bypasses all tool call confirmations for
  this server (default: `false`)
- **`includeTools`** (string[]): List of tool names to include from this MCP
  server. When specified, only the tools listed here will be available from this
  server (allowlist behavior). If not specified, all tools from the server are
  enabled by default.
- **`excludeTools`** (string[]): List of tool names to exclude from this MCP
  server. Tools listed here will not be available to the model, even if they are
  exposed by the server. **Note:** `excludeTools` takes precedence over
  `includeTools` - if a tool is in both lists, it will be excluded.
- **`targetAudience`** (string): The OAuth Client ID allowlisted on the
  IAP-protected application you are trying to access. Used with
  `authProviderType: 'service_account_impersonation'`.
- **`targetServiceAccount`** (string): The email address of the Google Cloud
  Service Account to impersonate. Used with
  `authProviderType: 'service_account_impersonation'`.

### OAuth Support for Remote MCP Servers

The Gemini CLI supports OAuth 2.0 authentication for remote MCP servers using
SSE or HTTP transports. This enables secure access to MCP servers that require
authentication.

#### Automatic OAuth Discovery

For servers that support OAuth discovery, you can omit the OAuth configuration
and let the CLI discover it automatically:

```json
{
  "mcpServers": {
    "discoveredServer": {
      "url": "https://api.example.com/sse"
    }
  }
}
```

The CLI will automatically:

- Detect when a server requires OAuth authentication (401 responses)
- Discover OAuth endpoints from server metadata
- Perform dynamic client registration if supported
- Handle the OAuth flow and token management

#### Authentication Flow

When connecting to an OAuth-enabled server:

1. **Initial connection attempt** fails with 401 Unauthorized
2. **OAuth discovery** finds authorization and token endpoints
3. **Browser opens** for user authentication (requires local browser access)
4. **Authorization code** is exchanged for access tokens
5. **Tokens are stored** securely for future use
6. **Connection retry** succeeds with valid tokens

#### Browser Redirect Requirements

**Important:** OAuth authentication requires that your local machine can:

- Open a web browser for authentication
- Receive redirects on `http://localhost:7777/oauth/callback`

This feature will not work in:

- Headless environments without browser access
- Remote SSH sessions without X11 forwarding
- Containerized environments without browser support

#### Managing OAuth Authentication

Use the `/mcp auth` command to manage OAuth authentication:

```bash
# List servers requiring authentication
/mcp auth

# Authenticate with a specific server
/mcp auth serverName

# Re-authenticate if tokens expire
/mcp auth serverName
```

#### OAuth Configuration Properties

- **`enabled`** (boolean): Enable OAuth for this server
- **`clientId`** (string): OAuth client identifier (optional with dynamic
  registration)
- **`clientSecret`** (string): OAuth client secret (optional for public clients)
- **`authorizationUrl`** (string): OAuth authorization endpoint (auto-discovered
  if omitted)
- **`tokenUrl`** (string): OAuth token endpoint (auto-discovered if omitted)
- **`scopes`** (string[]): Required OAuth scopes
- **`redirectUri`** (string): Custom redirect URI (defaults to
  `http://localhost:7777/oauth/callback`)
- **`tokenParamName`** (string): Query parameter name for tokens in SSE URLs
- **`audiences`** (string[]): Audiences the token is valid for

#### Token Management

OAuth tokens are automatically:

- **Stored securely** in `~/.gemini/mcp-oauth-tokens.json`
- **Refreshed** when expired (if refresh tokens are available)
- **Validated** before each connection attempt
- **Cleaned up** when invalid or expired

#### Authentication Provider Type

You can specify the authentication provider type using the `authProviderType`
property:

- **`authProviderType`** (string): Specifies the authentication provider. Can be
  one of the following:
  - **`dynamic_discovery`** (default): The CLI will automatically discover the
    OAuth configuration from the server.
  - **`google_credentials`**: The CLI will use the Google Application Default
    Credentials (ADC) to authenticate with the server. When using this provider,
    you must specify the required scopes.
  - **`service_account_impersonation`**: The CLI will impersonate a Google Cloud
    Service Account to authenticate with the server. This is useful for
    accessing IAP-protected services (this was specifically designed for Cloud
    Run services).

#### Google Credentials

```json
{
  "mcpServers": {
    "googleCloudServer": {
      "httpUrl": "https://my-gcp-service.run.app/mcp",
      "authProviderType": "google_credentials",
      "oauth": {
        "scopes": ["https://www.googleapis.com/auth/userinfo.email"]
      }
    }
  }
}
```

#### Service Account Impersonation

To authenticate with a server using Service Account Impersonation, you must set
the `authProviderType` to `service_account_impersonation` and provide the
following properties:

- **`targetAudience`** (string): The OAuth Client ID allowslisted on the
  IAP-protected application you are trying to access.
- **`targetServiceAccount`** (string): The email address of the Google Cloud
  Service Account to impersonate.

The CLI will use your local Application Default Credentials (ADC) to generate an
OIDC ID token for the specified service account and audience. This token will
then be used to authenticate with the MCP server.

#### Setup Instructions

1. **[Create](https://cloud.google.com/iap/docs/oauth-client-creation) or use an
   existing OAuth 2.0 client ID.** To use an existing OAuth 2.0 client ID,
   follow the steps in
   [How to share OAuth Clients](https://cloud.google.com/iap/docs/sharing-oauth-clients).
2. **Add the OAuth ID to the allowlist for
   [programmatic access](https://cloud.google.com/iap/docs/sharing-oauth-clients#programmatic_access)
   for the application.** Since Cloud Run is not yet a supported resource type
   in gcloud iap, you must allowlist the Client ID on the project.
3. **Create a service account.**
   [Documentation](https://cloud.google.com/iam/docs/service-accounts-create#creating),
   [Cloud Console Link](https://console.cloud.google.com/iam-admin/serviceaccounts)
4. **Add both the service account and users to the IAP Policy** in the
   "Security" tab of the Cloud Run service itself or via gcloud.
5. **Grant all users and groups** who will access the MCP Server the necessary
   permissions to
   [impersonate the service account](https://cloud.google.com/docs/authentication/use-service-account-impersonation)
   (i.e., `roles/iam.serviceAccountTokenCreator`).
6. **[Enable](https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com)
   the IAM Credentials API** for your project.

### Example Configurations

#### Python MCP Server (Stdio)

```json
{
  "mcpServers": {
    "pythonTools": {
      "command": "python",
      "args": ["-m", "my_mcp_server", "--port", "8080"],
      "cwd": "./mcp-servers/python",
      "env": {
        "DATABASE_URL": "$DB_CONNECTION_STRING",
        "API_KEY": "${EXTERNAL_API_KEY}"
      },
      "timeout": 15000
    }
  }
}
```

#### Node.js MCP Server (Stdio)

```json
{
  "mcpServers": {
    "nodeServer": {
      "command": "node",
      "args": ["dist/server.js", "--verbose"],
      "cwd": "./mcp-servers/node",
      "trust": true
    }
  }
}
```

#### Docker-based MCP Server

```json
{
  "mcpServers": {
    "dockerizedServer": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "API_KEY",
        "-v",
        "${PWD}:/workspace",
        "my-mcp-server:latest"
      ],
      "env": {
        "API_KEY": "$EXTERNAL_SERVICE_TOKEN"
      }
    }
  }
}
```

#### HTTP-based MCP Server

```json
{
  "mcpServers": {
    "httpServer": {
      "httpUrl": "http://localhost:3000/mcp",
      "timeout": 5000
    }
  }
}
```

#### HTTP-based MCP Server with Custom Headers

```json
{
  "mcpServers": {
    "httpServerWithAuth": {
      "httpUrl": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-api-token",
        "X-Custom-Header": "custom-value",
        "Content-Type": "application/json"
      },
      "timeout": 5000
    }
  }
}
```

#### MCP Server with Tool Filtering

```json
{
  "mcpServers": {
    "filteredServer": {
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "includeTools": ["safe_tool", "file_reader", "data_processor"],
      // "excludeTools": ["dangerous_tool", "file_deleter"],
      "timeout": 30000
    }
  }
}
```

### SSE MCP Server with SA Impersonation

```json
{
  "mcpServers": {
    "myIapProtectedServer": {
      "url": "https://my-iap-service.run.app/sse",
      "authProviderType": "service_account_impersonation",
      "targetAudience": "YOUR_IAP_CLIENT_ID.apps.googleusercontent.com",
      "targetServiceAccount": "your-sa@your-project.iam.gserviceaccount.com"
    }
  }
}
```

## Discovery Process Deep Dive

When the Gemini CLI starts, it performs MCP server discovery through the
following detailed process:

### 1. Server Iteration and Connection

For each configured server in `mcpServers`:

1. **Status tracking begins:** Server status is set to `CONNECTING`
2. **Transport selection:** Based on configuration properties:
   - `httpUrl` → `StreamableHTTPClientTransport`
   - `url` → `SSEClientTransport`
   - `command` → `StdioClientTransport`
3. **Connection establishment:** The MCP client attempts to connect with the
   configured timeout
4. **Error handling:** Connection failures are logged and the server status is
   set to `DISCONNECTED`

### 2. Tool Discovery

Upon successful connection:

1. **Tool listing:** The client calls the MCP server's tool listing endpoint
2. **Schema validation:** Each tool's function declaration is validated
3. **Tool filtering:** Tools are filtered based on `includeTools` and
   `excludeTools` configuration
4. **Name sanitization:** Tool names are cleaned to meet Gemini API
   requirements:
   - Invalid characters (non-alphanumeric, underscore, dot, hyphen) are replaced
     with underscores
   - Names longer than 63 characters are truncated with middle replacement
     (`___`)

### 3. Conflict Resolution

When multiple servers expose tools with the same name:

1. **First registration wins:** The first server to register a tool name gets
   the unprefixed name
2. **Automatic prefixing:** Subsequent servers get prefixed names:
   `serverName__toolName`
3. **Registry tracking:** The tool registry maintains mappings between server
   names and their tools

### 4. Schema Processing

Tool parameter schemas undergo sanitization for Gemini API compatibility:

- **`$schema` properties** are removed
- **`additionalProperties`** are stripped
- **`anyOf` with `default`** have their default values removed (Vertex AI
  compatibility)
- **Recursive processing** applies to nested schemas

### 5. Connection Management

After discovery:

- **Persistent connections:** Servers that successfully register tools maintain
  their connections
- **Cleanup:** Servers that provide no usable tools have their connections
  closed
- **Status updates:** Final server statuses are set to `CONNECTED` or
  `DISCONNECTED`

## Tool Execution Flow

When the Gemini model decides to use an MCP tool, the following execution flow
occurs:

### 1. Tool Invocation

The model generates a `FunctionCall` with:

- **Tool name:** The registered name (potentially prefixed)
- **Arguments:** JSON object matching the tool's parameter schema

### 2. Confirmation Process

Each `DiscoveredMCPTool` implements sophisticated confirmation logic:

#### Trust-based Bypass

```typescript
if (this.trust) {
  return false; // No confirmation needed
}
```

#### Dynamic Allow-listing

The system maintains internal allow-lists for:

- **Server-level:** `serverName` → All tools from this server are trusted
- **Tool-level:** `serverName.toolName` → This specific tool is trusted

#### User Choice Handling

When confirmation is required, users can choose:

- **Proceed once:** Execute this time only
- **Always allow this tool:** Add to tool-level allow-list
- **Always allow this server:** Add to server-level allow-list
- **Cancel:** Abort execution

### 3. Execution

Upon confirmation (or trust bypass):

1. **Parameter preparation:** Arguments are validated against the tool's schema
2. **MCP call:** The underlying `CallableTool` invokes the server with:

   ```typescript
   const functionCalls = [
     {
       name: this.serverToolName, // Original server tool name
       args: params,
     },
   ];
   ```

3. **Response processing:** Results are formatted for both LLM context and user
   display

### 4. Response Handling

The execution result contains:

- **`llmContent`:** Raw response parts for the language model's context
- **`returnDisplay`:** Formatted output for user display (often JSON in markdown
  code blocks)

## How to interact with your MCP server

### Using the `/mcp` Command

The `/mcp` command provides comprehensive information about your MCP server
setup:

```bash
/mcp
```

This displays:

- **Server list:** All configured MCP servers
- **Connection status:** `CONNECTED`, `CONNECTING`, or `DISCONNECTED`
- **Server details:** Configuration summary (excluding sensitive data)
- **Available tools:** List of tools from each server with descriptions
- **Discovery state:** Overall discovery process status

### Example `/mcp` Output

```
MCP Servers Status:

📡 pythonTools (CONNECTED)
  Command: python -m my_mcp_server --port 8080
  Working Directory: ./mcp-servers/python
  Timeout: 15000ms
  Tools: calculate_sum, file_analyzer, data_processor

🔌 nodeServer (DISCONNECTED)
  Command: node dist/server.js --verbose
  Error: Connection refused

🐳 dockerizedServer (CONNECTED)
  Command: docker run -i --rm -e API_KEY my-mcp-server:latest
  Tools: docker__deploy, docker__status

Discovery State: COMPLETED
```

### Tool Usage

Once discovered, MCP tools are available to the Gemini model like built-in
tools. The model will automatically:

1. **Select appropriate tools** based on your requests
2. **Present confirmation dialogs** (unless the server is trusted)
3. **Execute tools** with proper parameters
4. **Display results** in a user-friendly format

## Status Monitoring and Troubleshooting

### Connection States

The MCP integration tracks several states:

#### Server Status (`MCPServerStatus`)

- **`DISCONNECTED`:** Server is not connected or has errors
- **`CONNECTING`:** Connection attempt in progress
- **`CONNECTED`:** Server is connected and ready

#### Discovery State (`MCPDiscoveryState`)

- **`NOT_STARTED`:** Discovery hasn't begun
- **`IN_PROGRESS`:** Currently discovering servers
- **`COMPLETED`:** Discovery finished (with or without errors)

### Common Issues and Solutions

#### Server Won't Connect

**Symptoms:** Server shows `DISCONNECTED` status

**Troubleshooting:**

1. **Check configuration:** Verify `command`, `args`, and `cwd` are correct
2. **Test manually:** Run the server command directly to ensure it works
3. **Check dependencies:** Ensure all required packages are installed
4. **Review logs:** Look for error messages in the CLI output
5. **Verify permissions:** Ensure the CLI can execute the server command

#### No Tools Discovered

**Symptoms:** Server connects but no tools are available

**Troubleshooting:**

1. **Verify tool registration:** Ensure your server actually registers tools
2. **Check MCP protocol:** Confirm your server implements the MCP tool listing
   correctly
3. **Review server logs:** Check stderr output for server-side errors
4. **Test tool listing:** Manually test your server's tool discovery endpoint

#### Tools Not Executing

**Symptoms:** Tools are discovered but fail during execution

**Troubleshooting:**

1. **Parameter validation:** Ensure your tool accepts the expected parameters
2. **Schema compatibility:** Verify your input schemas are valid JSON Schema
3. **Error handling:** Check if your tool is throwing unhandled exceptions
4. **Timeout issues:** Consider increasing the `timeout` setting

#### Sandbox Compatibility

**Symptoms:** MCP servers fail when sandboxing is enabled

**Solutions:**

1. **Docker-based servers:** Use Docker containers that include all dependencies
2. **Path accessibility:** Ensure server executables are available in the
   sandbox
3. **Network access:** Configure sandbox to allow necessary network connections
4. **Environment variables:** Verify required environment variables are passed
   through

### Debugging Tips

1. **Enable debug mode:** Run the CLI with `--debug` for verbose output
2. **Check stderr:** MCP server stderr is captured and logged (INFO messages
   filtered)
3. **Test isolation:** Test your MCP server independently before integrating
4. **Incremental setup:** Start with simple tools before adding complex
   functionality
5. **Use `/mcp` frequently:** Monitor server status during development

## Important Notes

### Security Considerations

- **Trust settings:** The `trust` option bypasses all confirmation dialogs. Use
  cautiously and only for servers you completely control
- **Access tokens:** Be security-aware when configuring environment variables
  containing API keys or tokens
- **Sandbox compatibility:** When using sandboxing, ensure MCP servers are
  available within the sandbox environment
- **Private data:** Using broadly scoped personal access tokens can lead to
  information leakage between repositories

### Performance and Resource Management

- **Connection persistence:** The CLI maintains persistent connections to
  servers that successfully register tools
- **Automatic cleanup:** Connections to servers providing no tools are
  automatically closed
- **Timeout management:** Configure appropriate timeouts based on your server's
  response characteristics
- **Resource monitoring:** MCP servers run as separate processes and consume
  system resources

### Schema Compatibility

- **Property stripping:** The system automatically removes certain schema
  properties (`$schema`, `additionalProperties`) for Gemini API compatibility
- **Name sanitization:** Tool names are automatically sanitized to meet API
  requirements
- **Conflict resolution:** Tool name conflicts between servers are resolved
  through automatic prefixing

This comprehensive integration makes MCP servers a powerful way to extend the
Gemini CLI's capabilities while maintaining security, reliability, and ease of
use.

## Returning Rich Content from Tools

MCP tools are not limited to returning simple text. You can return rich,
multi-part content, including text, images, audio, and other binary data in a
single tool response. This allows you to build powerful tools that can provide
diverse information to the model in a single turn.

All data returned from the tool is processed and sent to the model as context
for its next generation, enabling it to reason about or summarize the provided
information.

### How It Works

To return rich content, your tool's response must adhere to the MCP
specification for a
[`CallToolResult`](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result).
The `content` field of the result should be an array of `ContentBlock` objects.
The Gemini CLI will correctly process this array, separating text from binary
data and packaging it for the model.

You can mix and match different content block types in the `content` array. The
supported block types include:

- `text`
- `image`
- `audio`
- `resource` (embedded content)
- `resource_link`

### Example: Returning Text and an Image

Here is an example of a valid JSON response from an MCP tool that returns both a
text description and an image:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Here is the logo you requested."
    },
    {
      "type": "image",
      "data": "BASE64_ENCODED_IMAGE_DATA_HERE",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "The logo was created in 2025."
    }
  ]
}
```

When the Gemini CLI receives this response, it will:

1.  Extract all the text and combine it into a single `functionResponse` part
    for the model.
2.  Present the image data as a separate `inlineData` part.
3.  Provide a clean, user-friendly summary in the CLI, indicating that both text
    and an image were received.

This enables you to build sophisticated tools that can provide rich, multi-modal
context to the Gemini model.

## MCP Prompts as Slash Commands

In addition to tools, MCP servers can expose predefined prompts that can be
executed as slash commands within the Gemini CLI. This allows you to create
shortcuts for common or complex queries that can be easily invoked by name.

### Defining Prompts on the Server

Here's a small example of a stdio MCP server that defines prompts:

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'prompt-server',
  version: '1.0.0',
});

server.registerPrompt(
  'poem-writer',
  {
    title: 'Poem Writer',
    description: 'Write a nice haiku',
    argsSchema: { title: z.string(), mood: z.string().optional() },
  },
  ({ title, mood }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Write a haiku${mood ? ` with the mood ${mood}` : ''} called ${title}. Note that a haiku is 5 syllables followed by 7 syllables followed by 5 syllables `,
        },
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

This can be included in `settings.json` under `mcpServers` with:

```json
{
  "mcpServers": {
    "nodeServer": {
      "command": "node",
      "args": ["filename.ts"]
    }
  }
}
```

### Invoking Prompts

Once a prompt is discovered, you can invoke it using its name as a slash
command. The CLI will automatically handle parsing arguments.

```bash
/poem-writer --title="Gemini CLI" --mood="reverent"
```

or, using positional arguments:

```bash
/poem-writer "Gemini CLI" reverent
```

When you run this command, the Gemini CLI executes the `prompts/get` method on
the MCP server with the provided arguments. The server is responsible for
substituting the arguments into the prompt template and returning the final
prompt text. The CLI then sends this prompt to the model for execution. This
provides a convenient way to automate and share common workflows.

## Managing MCP Servers with `gemini mcp`

While you can always configure MCP servers by manually editing your
`settings.json` file, the Gemini CLI provides a convenient set of commands to
manage your server configurations programmatically. These commands streamline
the process of adding, listing, and removing MCP servers without needing to
directly edit JSON files.

### Adding a Server (`gemini mcp add`)

The `add` command configures a new MCP server in your `settings.json`. Based on
the scope (`-s, --scope`), it will be added to either the user config
`~/.gemini/settings.json` or the project config `.gemini/settings.json` file.

**Command:**

```bash
gemini mcp add [options] <name> <commandOrUrl> [args...]
```

- `<name>`: A unique name for the server.
- `<commandOrUrl>`: The command to execute (for `stdio`) or the URL (for
  `http`/`sse`).
- `[args...]`: Optional arguments for a `stdio` command.

**Options (Flags):**

- `-s, --scope`: Configuration scope (user or project). [default: "project"]
- `-t, --transport`: Transport type (stdio, sse, http). [default: "stdio"]
- `-e, --env`: Set environment variables (e.g. -e KEY=value).
- `-H, --header`: Set HTTP headers for SSE and HTTP transports (e.g. -H
  "X-Api-Key: abc123" -H "Authorization: Bearer abc123").
- `--timeout`: Set connection timeout in milliseconds.
- `--trust`: Trust the server (bypass all tool call confirmation prompts).
- `--description`: Set the description for the server.
- `--include-tools`: A comma-separated list of tools to include.
- `--exclude-tools`: A comma-separated list of tools to exclude.

#### Adding an stdio server

This is the default transport for running local servers.

```bash
# Basic syntax
gemini mcp add <name> <command> [args...]

# Example: Adding a local server
gemini mcp add my-stdio-server -e API_KEY=123 /path/to/server arg1 arg2 arg3

# Example: Adding a local python server
gemini mcp add python-server python server.py --port 8080
```

#### Adding an HTTP server

This transport is for servers that use the streamable HTTP transport.

```bash
# Basic syntax
gemini mcp add --transport http <name> <url>

# Example: Adding an HTTP server
gemini mcp add --transport http http-server https://api.example.com/mcp/

# Example: Adding an HTTP server with an authentication header
gemini mcp add --transport http secure-http https://api.example.com/mcp/ --header "Authorization: Bearer abc123"
```

#### Adding an SSE server

This transport is for servers that use Server-Sent Events (SSE).

```bash
# Basic syntax
gemini mcp add --transport sse <name> <url>

# Example: Adding an SSE server
gemini mcp add --transport sse sse-server https://api.example.com/sse/

# Example: Adding an SSE server with an authentication header
gemini mcp add --transport sse secure-sse https://api.example.com/sse/ --header "Authorization: Bearer abc123"
```

### Listing Servers (`gemini mcp list`)

To view all MCP servers currently configured, use the `list` command. It
displays each server's name, configuration details, and connection status.

**Command:**

```bash
gemini mcp list
```

**Example Output:**

```sh
✓ stdio-server: command: python3 server.py (stdio) - Connected
✓ http-server: https://api.example.com/mcp (http) - Connected
✗ sse-server: https://api.example.com/sse (sse) - Disconnected
```

### Removing a Server (`gemini mcp remove`)

To delete a server from your configuration, use the `remove` command with the
server's name.

**Command:**

```bash
gemini mcp remove <name>
```

**Example:**

```bash
gemini mcp remove my-server
```

This will find and delete the "my-server" entry from the `mcpServers` object in
the appropriate `settings.json` file based on the scope (`-s, --scope`).

# Memory Tool (`save_memory`)

This document describes the `save_memory` tool for the Gemini CLI.

## Description

Use `save_memory` to save and recall information across your Gemini CLI
sessions. With `save_memory`, you can direct the CLI to remember key details
across sessions, providing personalized and directed assistance.

### Arguments

`save_memory` takes one argument:

- `fact` (string, required): The specific fact or piece of information to
  remember. This should be a clear, self-contained statement written in natural
  language.

## How to use `save_memory` with the Gemini CLI

The tool appends the provided `fact` to a special `GEMINI.md` file located in
the user's home directory (`~/.gemini/GEMINI.md`). This file can be configured
to have a different name.

Once added, the facts are stored under a `## Gemini Added Memories` section.
This file is loaded as context in subsequent sessions, allowing the CLI to
recall the saved information.

Usage:

```
save_memory(fact="Your fact here.")
```

### `save_memory` examples

Remember a user preference:

```
save_memory(fact="My preferred programming language is Python.")
```

Store a project-specific detail:

```
save_memory(fact="The project I'm currently working on is called 'gemini-cli'.")
```

## Important notes

- **General usage:** This tool should be used for concise, important facts. It
  is not intended for storing large amounts of data or conversational history.
- **Memory file:** The memory file is a plain text Markdown file, so you can
  view and edit it manually if needed.