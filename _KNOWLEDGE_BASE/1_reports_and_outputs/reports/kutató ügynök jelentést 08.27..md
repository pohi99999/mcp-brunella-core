

# **Kutató Ügynök Havi Jelentés: Gemini CLI és AI trendek**

### **1\. Legújabb trendek, változások (CLI, Gemini, AI)**

A Gemini CLI világában az elmúlt időszak legfontosabb újdonságai a mélyebb IDE-integráció és a fejlettebb automatizálási képességek. Kiemelkedő a VS Code és a Zed integrációja, amelyek a parancssori hatékonyságot a vizuális szerkesztők kényelmével ötvözik, valamint a GitHub Actions bevezetése, amely lehetővé teszi az AI-alapú munkafolyamatok automatizálását a repository-kban.

### **2\. Legjobb CLI eszközök/technikák – top 3**

#### **2.1. Gemini CLI IDE-integráció (VS Code & Zed)**

* **Telepítés**:  
  Bash  
  npm install \-g @google/gemini-cli  
  gemini /ide install  
  gemini /ide enable

* **Főbb funkciók**:  
  * Kontextus-érzékeny javaslatok közvetlenül a szerkesztőben (pl. megnyitott fájlok és kijelölt szöveg alapján).  
  * Natív, teljes képernyős diff-nézet, ahol a javasolt változtatásokat közvetlenül szerkesztheted és fogadhatod el.  
  * Valós idejű végrehajtás és a változtatások nyomon követése a szerkesztőben.  
* Példák:  
  A VS Code integrált termináljában megnyitott kódban megkérheted a Geminit, hogy generáljon egy tesztet a kijelölt funkcióhoz, és a javaslatot egyből a szerkesztőben láthatod és módosíthatod.  
* **Ajánlott workflow**:  
  1. A projekt megnyitása a támogatott IDE-ben (pl. VS Code).  
  2. A Gemini CLI elindítása az integrált terminálban.  
  3. A /ide enable paranccsal aktiválni az IDE-integrációt.  
  4. Természetes nyelven leírni a feladatot, pl. "refaktoráld ezt a függvényt, hogy aszinkron legyen".  
  5. A kapott javaslatokat átnézni és elfogadni a diff nézetben.

#### **2.2. Gemini CLI GitHub Actions**

* **Telepítés**: A GitHub Actions beállítása a repository-ban.  
* **Főbb funkciók**:  
  * **Intelligens issue triage**: Automatikus címkézés és priorizálás a bejövő issue-k alapján.  
  * **Gyorsított pull request review-k**: Az AI azonnali visszajelzést ad a kód minőségéről és stílusáról.  
  * **Igény szerinti kollaboráció**: A @gemini-cli megemlítésével delegálhatsz feladatokat egy issue-ban vagy pull request-ben (pl. "írd meg a teszteket ehhez a hibához").  
* Példák:  
  Létrehozol egy új pull requestet, és a Gemini automatikusan futtatja az Action-t, és megjegyzéseket fűz a kódhoz a lehetséges hibákról vagy a stílusbeli eltérésekről.  
* **Ajánlott workflow**:  
  1. Hozd létre a .github/workflows/gemini-automated-pr-review.yml fájlt a repository-dban.  
  2. Állítsd be, hogy a pull\_request eseményre fusson le.  
  3. A munkafolyamat konfigurálása a Gemini CLI Action használatával a kód elemzésére.

#### **2.3. Egyéni Slash parancsok**

* **Telepítés**: Nincs szükség külön telepítésre, a funkció beépített.  
* **Főbb funkciók**:  
  * Saját, újrahasznosítható promptokat definiálhatsz, amelyekkel felgyorsíthatod a gyakori interakciókat.  
  * A parancsok projekt- vagy felhasználói szinten is definiálhatók .toml fájlokban.  
* Példák:  
  A \~/.gemini/commands/plan.toml fájl létrehozásával definiálhatsz egy /plan parancsot, ami arra utasítja a Geminit, hogy csak egy lépésről lépésre szóló stratégiai tervet adjon, kód generálása nélkül.  
* **Ajánlott workflow**:  
  1. mkdir \-p \~/.gemini/commands  
  2. Hozz létre egy új .toml fájlt, pl. plan.toml a könyvtárban.  
  3. Illeszd be a promptot a fájlba.  
  4. A parancs ezután elérhető lesz a Gemini CLI-ben a /plan paranccsal.

### **3\. Gemini-specifikus újdonságok, tippek**

* **Új integrációk/parancsok**:  
  * **Multi-Directory támogatás**: A /directory add path/to/dir paranccsal több munkakönyvtárat is hozzáadhatsz egy munkamenethez.  
  * **/init parancs**: Automatikusan generál egy GEMINI.md kontextusfájlt a projekt tartalmából, ezzel jelentősen javítva a Gemini kontextus-érzékenységét.  
* **Magyarázat, mikor használjuk, mire jó**:  
  * A multi-directory funkcióval könnyedén integrálhatsz külső könyvtárakat vagy dokumentációt anélkül, hogy a saját kódodba kellene másolnod.  
  * A /init parancs ideális új projektek indításakor vagy a projektkontextus gyors összefoglalásához, ami csökkenti a modell "hallucinációjának" esélyét.

### **4\. Ajánlott oktatási prompt**

Feladat:  
Készíts egy részletes, lépésről lépésre bemutató oktatási promptot, amely a Gemini CLI IDE-integrációját és a multi-directory használatát mutatja be, példákkal és ajánlott workflow-val\!  
**Prompt példa**:

Te vagy egy CLI/Gemini szakértő. Tanítsd meg nekem, hogyan használjam a Gemini CLI legújabb IDE-integrációs és multi-directory funkcióit a hatékonyabb kódolás érdekében.

A magyarázat a következő lépéseket tartalmazza:  
1\. Az integráció beállítása (pl. VS Code esetén).  
2\. Egy példa a kontextus-érzékeny kódgenerálásra.  
3\. A multi-directory funkció használata egy külső library kontextusának hozzáadására.  
4\. Egy javasolt napi workflow, ami kombinálja a két funkciót.

Használj beilleszthető, végrehajtható parancsokat és kódblokkokat minden lépésnél\!  
