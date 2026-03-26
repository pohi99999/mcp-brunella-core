# Spec: Könyvelés automatizálása

Összefoglaló
-----------
Ez a specifikáció részletezi a számla- és bankegyeztetés automatizálásának technikai követelményeit, adatmodelleket és interfészeket. A cél egy moduláris agent-alapú pipeline létrehozása, amely képes PDF és XML alapú bizonylatok feldolgozására, mezők kinyerésére, banki párosításra és kivételes esetek jelentésére.

Architektúra
-----------
- Input Layer: Email Agent (IMAP/GDrive), NAV-API Agent (XML), Bank Agent (API/CSV)
- Processing Layer: Validation & Matching Agent, Classification Agent, OCR/LLM extraction
- Persistence: Lokális/Cloud storage (`data/`), Google Sheets integration opcionális, SQLite a track metadata-hoz
- Orchestration: AgentManager (szabványos `IAgent` implementációk, Task Queue)
- Observability: OpenTelemetry traces, napi összefoglaló email

Adatmodellek (minta JSON)
-------------------------
Invoice (extracted):
```
{
  "id": "INV-2026-0001",
  "source": "email|nav",
  "partner": {
    "name": "Kovács Kft.",
    "taxId": "12345678-2-12",
    "bankAccount": "HUxx"
  },
  "amounts": { "net": 40000, "vat": 8080, "gross": 48080 },
  "currency": "HUF",
  "issueDate": "2026-03-01",
  "dueDate": "2026-03-15",
  "paymentMethod": "bank_transfer",
  "pdfPath": "data/invoices/Kovacs_2026-03-01_48080.pdf",
  "navXmlPath": "data/nav/INV-2026-0001.xml"
}
```

BankTransaction (minta):
```
{
  "id": "BTX-20260302-001",
  "date": "2026-03-02",
  "amount": 48080,
  "counterparty": "Kovács Kft.",
  "bankAccount": "HUyy",
  "description": "Invoice 2026-03-01",
  "raw": {...}
}
```

Szolgáltatások és végpontok
---------------------------
- `agent/email/fetch` — letöltött PDF-ek listája
- `agent/nav/fetch` — NAV XML-ek listája
- `agent/ocr/extract` — PDF→kinyert mezők
- `agent/match/run` — párosítás futtatása, kimenet: matches + exceptions
- `agent/bank/fetch` — bank tranzakciók (CSV/JSON)

Párosítási szabályok (kivonat)
-----------------------------
1) Egyezés összeg + dátum közelítő (±2 nap) + partner név → KIEGYENLÍTVE
2) Részösszeges fizetés: Ha egy utalás megegyezik több számla összegével összesen, javaslat: "partially_settled" és tételes hozzárendelés javaslat
3) Több utalás egy számlára: kezelhető, ha utalások összesen = számla összege
4) Nevezeti tolerancia: apró eltérések (pl. 1-2 Ft) esetén automata kiegyenlítés, ha partner és dátum megegyezik

Esetek és hibakezelés
--------------------
- Hiányzó PDF: `exceptions/missing_pdf.json` — trigger: automata email kéréssel a partnertől
- NAV mismatch (XML vs PDF összeg): `exceptions/nav_mismatch.json` — emberi review szükséges
- Bank mismatch: `exceptions/bank_mismatch.json` — automatizált javaslat, manuális jóváhagyás

Biztonság és jogosultság
------------------------
- Access: Bizalmas fájlok (PDF, XML) csak a `Finance` RBAC csoport számára olvashatók.
- Titkosítás: Tárolt fájlok S3/R2 esetén titkosítva legyenek.

Logging és monitoring
----------------------
- Minden agent futás logolva → OpenTelemetry span és napi összefoglaló riport
- Hibák: Slack/Email alert a `FinanceOps` csatornára, ha exception count > 5

Acceptance Criteria (kezdeti)
----------------------------
1) A pipeline képes feldolgozni 100 sample PDF+XML+bank rows/napot
2) Automata matching pontosság ≥ 90% alap eseteknél
3) Kivételes esetek listázása és e-mail értesítés működik
