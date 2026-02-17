MEGVALÓSÍTÁSI TERV (plan.md)

Track: invoice-to-sheets-automation-20260214

Verzió: 1.0





Protokoll: EPP v2 

+1



🛠️ Fázisok és Feladatok

Phase 1: Környezet és Séma Definíció 

+1





Pydantic séma létrehozása: A myai/schemas/invoice.py fájlban definiálni kell az InvoiceData osztályt (Partner, Összeg, Áfa, Dátum, Határidő).

+1





Titkok beállítása: A .env fájl frissítése SZAMLAZZ\_HU\_API\_KEY és GOOGLE\_SHEETS\_ID változókkal.

+2



Google Sheets API engedélyezés: Szolgáltatási fiók (Service Account) JSON fájl elhelyezése a config/ mappában.



Phase 2: Harvest (Adatgyűjtés) Integráció 

+1



Számlázz.hu API kliens: Python script írása, amely lekéri a legfrissebb számlákat JSON formátumban.





Gmail Fallback: A Robotkéz (Browser-Use) felkészítése a Gmailből való PDF letöltésre, ha az API nem elérhető.

+1





MCP Tool frissítés: Az mcp-brunella-core bővítése egy get\_invoices funkcióval.



Phase 3: Refine \& Index (Feldolgozás és Memória) 

+1





Refiner Logic: Az adatok validálása a Phase 1-ben létrehozott sémával.

+1





Szemantikus Mentés: A feldolgozott számlaadatok indexelése a LanceDB-be a későbbi RAG lekérdezésekhez.

+2



Phase 4: Execute (Google Sheets Export) 

+1



Sheets Tool: Új Python segédprogram (myai/utils/sheets\_client.py), amely a google-api-python-client segítségével sorokat fűz a táblázathoz.





Hibakezelés: A Phoenix Protocol integrálása (automatikus újrapróbálkozás hálózati hiba esetén).

+2



Phase 5: Dashboard \& CLI (EPP v2 Compliance) 

+1





CLI parancs: A brunella invoices sync parancs implementálása magyar nyelvű interaktív menüvel.

+2





Dashboard Widget: Új React komponens a Mission Control felületre, amely mutatja a szinkronizálási állapotot.

+2



🧪 Tesztelési Terv

Unit Tesztek: A Pydantic validátor tesztelése hibás számlaadatokkal.



Integrációs Teszt: Egy teszt-számla sikeres átvitele a Számlázz.hu-ról a Google Sheets-be.





EPP v2 Validáció: npm test futtatása, 100% pass rate elérése.

+2

