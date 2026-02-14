Funkcionális célok:



Neural Link Chat: Egy interaktív felület a Dashboardon, ahol az új belépők természetes nyelven kérdezhetnek a cég működéséről.

+1





Context Harvesting: Az ágens beolvassa a SUMMARY.md fájlokat, a product-guidelines.md-t és a projekt struktúráját.

+2





Outdated Info Alert: Ha egy Slack/Teams beszélgetésben új döntés születik, ami ellentmond a leírt dokumentációnak, az EvaluatorAgent  riasztást küld a menedzsmentnek.

+1



🏗️ Technikai megvalósítás:



Memory Layer: Használjuk a meglévő myai/utils/dataset\_manager.py logikát az adatok strukturált mentéséhez.





Embedding: A kinyert szövegeket vektorizáljuk és a LanceDB-be tároljuk.

+1





RAG Flow: A lekérdezésnél a Gemini 1.5 Pro vagy GPT-4o  generálja a választ a megtalált kontextus alapján.



