# Specifikáció: Modular State Refactor

## 🎯 Célkitűzés
A Brunella Agent System belső állapotkezelésének és adatbázis-hozzáférésének modernizálása. A cél a modul-szintű globális változók (`let db = null`) megszüntetése és az Inversion of Control (IoC) / Dependency Injection (DI) elvek bevezetése a jobb tesztelhetőség és izoláció érdekében.

## ⚠️ Jelenlegi Probléma
- `utils/db.ts`, `utils/tasksDb.ts` és `utils/rag.ts` globális változókat használnak az állapottároláshoz.
- Nehézkes Unit tesztelés a globális állapot miatt (tesztek közötti interferencia).
- Szoros csatolás a modulok között.

## ✅ Elvárt Állapot
- Az állapotokat (pl. DB kapcsolatok) osztályok (Classes) példányai kezelik.
- A modulok konstruktoron vagy init függvényen keresztül kapják meg a függőségeiket.
- Standardizált Singleton minta (ahol tényleg szükséges), de explicit életciklus-kezeléssel (start/stop).

## 🛠️ Technikai Követelmények
- SOLID alapelvek betartása (különösen a Single Responsibility).
- Az új osztályoknak legyen `dispose()` vagy `close()` metódusa az erőforrások felszabadítására.
- Vitest mockolási minták frissítése az új architektúrához.
