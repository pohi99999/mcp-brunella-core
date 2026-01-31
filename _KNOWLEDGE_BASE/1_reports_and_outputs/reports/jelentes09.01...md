Kutató Ügynök Jelentés

Dátum: 2025\. Szeptember 1\.  
Projekt: "Multiplier"  
Státusz: Folyamatban

### **1\. Legújabb trendek, változások (CLI, Gemini, AI)**

Az elmúlt időszak legfontosabb trendje az autonóm AI ügynök rendszerek megbízhatóságának és koordinációjának növelése. A figyelem a monolitikus, egyetlen promptra épülő modellektől a strukturált, több ügynökből álló, specializált rendszerek felé tolódik.

* **Strukturált gondolkodás és önkorrekció**: A legújabb módszertanok, mint a ReAct (Reasoning \+ Acting) és a "Belső Monológ" (Internal Monologue) technikák, arra ösztönzik az ügynököket, hogy a válaszadás előtt lépésről lépésre vezessék le a gondolatmenetüket. Ez drasztikusan javítja a komplex feladatok megoldásának minőségét és csökkenti a hibák számát.  
* **Ügynök-koordinációs keretrendszerek**: Eszközök, mint a CrewAI és a LangGraph, egyre népszerűbbek a több ügynökből álló csapatok orchestrálására. Ezek lehetővé teszik a feladatok hatékony delegálását, az állapotkövetést és a hibakezelést, ami a "Multiplier" projekt központi célkitűzése.  
* **Parancssori (CLI) integráció**: A legújabb eszközök, mint a nemrég bemutatott nyílt forráskódú **Gemini CLI**, a Gemini erejét közvetlenül a fejlesztői terminálba hozzák. Ez lehetővé teszi a fejlesztési és automatizálási munkafolyamatok mélyebb integrációját, ahol az ügynökök közvetlenül hajthatnak végre parancsokat, kezelhetnek fájlokat és integrálódhatnak más rendszerekkel.

### **2\. Legjobb CLI eszközök/technikák – top 3**

#### **2.1. Gemini CLI**

A Google által nyílt forráskódúvá tett AI ügynök, amely a Gemini képességeit közvetlenül a terminálba integrálja. Lehetővé teszi a kódértelmezést, generálást, automatizálást és a legújabb Gemini 1.5 Pro modellhez való hozzáférést.

* **Telepítés**:  
  Bash  
  \# Azonnali futtatás telepítés nélkül  
  npx https://github.com/google-gemini/gemini-cli

  \# Vagy globális telepítés npm-mel  
  npm install \-g @google/gemini-cli

* **Főbb funkciók**:  
  * **Ingyenes hozzáférés**: Személyes Google fiókkal percenként 60, naponta 1000 kérés ingyenes.  
  * **Gemini 1.5 Pro**: Hozzáférés az 1 millió tokenes kontextusablakhoz, ami lehetővé teszi nagy kódbázisok elemzését is.  
  * **Beépített eszközök**: Google Keresés, fájlrendszer-műveletek, shell parancsok futtatása és webes tartalmak lekérése.  
  * **Bővíthetőség**: MCP (Model Context Protocol) támogatás egyéni integrációkhoz, például GitHub vagy Slack vezérléséhez.  
* **Példák**:  
  Bash  
  \# Kódbázis elemzése  
  cd projekt-mappa/  
  gemini  
  \> Adj egy összefoglalót az elmúlt 24 óra változásairól a git log alapján.

  \# Új alkalmazás generálása leírásból  
  gemini  
  \> Írj egy Python szkriptet, ami figyeli a \`logs/app.log\` fájlt és emailt küld, ha "ERROR" szöveget talál.

* **Ajánlott workflow**:  
  1. Indítsd el a gemini parancsot a projekt gyökerében, hogy hozzáférjen a helyi fájlokhoz.  
  2. Természetes nyelven add meg a feladatot (pl. "Refaktoráld ezt a komponenst, hogy state managementet használjon.").  
  3. Az ügynök javaslatot tesz a fájlok módosítására, amelyeket jóváhagyás után végrehajt.

#### **2.2. Technika: Belső Monológ / Gondolkodási Puffer (Internal Monologue / Thought Buffer)**

Ez egy promptolási technika, amely arra utasítja az ügynököt, hogy a végső válasz előtt egy speciális \<thought\> tag-ben fejtse ki a gondolatmenetét, a döntési logikáját és a tervezett lépéseket. Ez a "hangos gondolkodás" lehetővé teszi az önkorrekciót és drasztikusan javítja a megbízhatóságot.

* **Alkalmazás**: Minden ügynök (különösen a menedzser és a tervező) alapvető "Alkotmányába" integrálandó.  
* **Példa prompt elem**:  
  A feladat megoldása során kövesd az alábbi folyamatot:  
  1\. Elemezd a célt és a bemeneti adatokat.  
  2\. Fogalmazz meg egy lépésről-lépésre tervet.  
  3\. Hajtsd végre a tervet, szükség esetén használj eszközöket.  
  4\. Kritikusan értékeld az eredményeket és ellenőrizd, hogy a cél teljesült-e.  
  5\. Fogalmazd meg a végső választ.

  A teljes belső gondolatmenetedet a \`\` blokkban írd le, mit és miért fogsz tenni.

  A végeredmény egy teljes, futtatható shell szkript és annak részletes magyarázata legyen.  
