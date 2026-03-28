Konyveles Automatizalas - Discovery & Connectors
===============================================

Futtatási útmutató (lokálisan)

1) Telepítsd a függőségeket (ha még nem):

```bash
npm install
```

2) A mintafuttatáshoz használd a discovery scriptet, ami a `conductor/tracks/konyveles_automatizalas/resources/samples` mappában lévő fájlokat dolgozza fel:

```bash
node scripts/konyveles_discovery_run.js
```

3) Környezeti változók IMAP / GDrive integrációhoz (opcionális):

- IMAP: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`, `IMAP_MAILBOX`, `IMAP_MARKSEEN`
- Google Drive: `GDRIVE_SERVICE_ACCOUNT` (path to service account JSON), `GDRIVE_FOLDER_ID`

4) NAV kliens beállítás (opcionális):

- Használhatsz `mTLS`-t (client cert + key) vagy OAuth2 client_credentials flow-t. Lásd `src/clients/navClient.ts`.

5) Output:

- A discovery futtatás eredménye mentésre kerül: `data/konyveles/match_results.json`.

Fejlesztési jegyzetek
- A `src/connectors/imapConnector.ts` tartalmazza a `fetchAndExtractAttachments` függvényt, amely letölti a csatolmányokat és menti őket `data/invoices` alá.
- A `src/connectors/gdriveConnector.ts` letölti a fájlokat egy Drive mappából (service account használható).
- A `src/matching/matcher.ts` egy egyszerű heuritikusan pontozó párosítót tartalmaz; finomhangolható további minták és szabályok hozzáadásával.
- Az új `conductor/tracks/konyveles_automatizalas/design/matching_engine.md` dokumentáció részletezi a pontozási, kivételkezelési és integrációs stratégiát, valamint leírja, hogyan illeszkednek a `scripts/konyveles_discovery_run.js` és `data/bookkeeping_db.ts` modulokhoz.
