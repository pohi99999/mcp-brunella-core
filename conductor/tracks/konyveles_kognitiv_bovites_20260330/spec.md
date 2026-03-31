# Specifikáció: Kognitív Könyvelés és Multi-Ágens Egyeztetés — Bővítmény

**Track ID:** `konyveles_kognitiv_bovites_20260330`
**Prioritás:** HIGH
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-30
**Alap-track:** `n8n_konyveles_pipeline_20260328` (85% készre épít)

---

## 1. Célkitűzés

A meglévő n8n könyvelési pipeline-t (NAV/Bank/Számla feldolgozás) kognitív intelligenciával bővíteni:
- **MCP tudásbázis:** A vállalat saját számviteli politikája és a Számviteli Törvény alapján kontírozó LLM
- **Multi-ágens reconciliation:** Kivételkezelés, részleges fizetések, kommunikációs ágensek
- **Proaktív védelem:** Anomáliadetektálás és 14-30 napos cash-flow előrejelzés

**Nem cél most:** Teljes ERP integráció, szamlazz.hu kimenő számla generálás (más track), 3. fél számviteli szoftver csere.

---

## 2. Architektúra

```
MEGLÉVŐ PIPELINE (n8n_konyveles_pipeline_20260328)
    ↓
KOGNITÍV RÉTEG (ez a track)
─────────────────────────────────────────────────────────────
MCP Szerver (accounting-knowledge-mcp)
    ↑                       ↑
LanceDB                  Számviteli
(vektorizált             Törvény +
  docs)                  Politika docs
─────────────────────────────────────────────────────────────
Langflow (kognitív motor)
  ├── accounting-rag-chain        (kontírozási asszisztens)
  ├── reconciliation-exception    (kivételkezelő logika)
  ├── anomaly-detection-chain     (anomália elemzés)
  └── cashflow-prediction-chain   (előrejelzés)
─────────────────────────────────────────────────────────────
n8n Új Workflow-ok
  ├── WF-6: Advanced Reconciliation
  ├── WF-7: Exception + Communication
  ├── WF-8: Anomaly Monitor (Cron)
  └── WF-9: Human-in-Loop Approval
─────────────────────────────────────────────────────────────
BAS Új Ágensek (src/agents/)
  ├── ReconciliationIngestionAgent.ts
  ├── AdvancedMatchingAgent.ts
  ├── ReconciliationExceptionAgent.ts
  ├── ReconciliationCommunicationAgent.ts
  ├── NavCrossCheckAgent.ts
  ├── AnomalyDetectionAgent.ts
  └── CashFlowPredictionAgent.ts
─────────────────────────────────────────────────────────────
Dashboard Új Widgetek
  ├── AccountingKbWidget.tsx       (tudásbázis keresés)
  └── CashFlowWidget.tsx           (predikció grafikon)
```

---

## 3. MCP Szerver Specifikáció

**Szerver neve:** `accounting-knowledge-mcp`
**Fájl:** `src/mcp/accountingKnowledgeMcp.ts`
**Transport:** stdio (Claude Desktop kompatibilis) + HTTP REST

### Elérhető Tool-ok:

| Tool neve | Input | Output | Leírás |
|---|---|---|---|
| `search_accounting_policy` | `{ query: string, limit?: number }` | `[{ text, source, score }]` | Számviteli politika RAG keresés |
| `get_chart_of_accounts` | `{ class?: number }` | `[{ account_number, name, type }]` | Számlatükör lekérdezés |
| `find_similar_entries` | `{ description: string, amount?: number }` | `[{ entry, account, confidence }]` | Hasonló múltbeli kontírozások |
| `get_nav_validation_rules` | `{ invoice_type: string }` | `{ rules: [...] }` | NAV API validációs szabályok |

### LanceDB séma (accounting_kb tábla):
```json
{
  "id": "uuid",
  "source_type": "policy | chart_of_accounts | historical_entry | nav_rules",
  "content": "szöveg tartalom",
  "vector": [1536-dim float array],
  "metadata": {
    "account_number": "string",
    "document": "string",
    "date": "ISO 8601",
    "anonymized": true
  }
}
```

---

## 4. Multi-Ágens Reconciliation Specifikáció

### Egyeztetési prioritási logika (Párosító Ágens):

```
Szint 1: Egzakt egyezés (számlaszám + összeg + dátum ±3 nap) → AUTO MATCH
Szint 2: Összeg-tartomány (±1% kerekítési tűrés) → AUTO MATCH
Szint 3: Partner + összeg (közlemény nélkül) → SOFT MATCH, review szükséges
Szint 4: Szemantikus (cosine similarity > 0.85 a közlemény rovaton) → SUGGEST
Szint 5: Párosítatlan → Exception Queue
```

### Kivétel rekord struktúra:
```typescript
interface ReconciliationException {
  id: string;
  bank_transaction_id: string;
  amount: number;
  currency: 'HUF' | 'EUR' | 'USD';
  partner_name?: string;
  probable_cause: 'timing_difference' | 'partial_payment' | 'fx_difference' | 'wrong_reference' | 'unknown';
  confidence: number; // 0-1
  suggested_action: 'wait' | 'contact_partner' | 'manual_review' | 'split_payment';
  ai_rationale: string;
  created_at: string;
  resolved_at?: string;
}
```

---

## 5. Anomáliadetektálás Küszöbértékek

| Anomália típusa | Trigger küszöb | Riasztási szint |
|---|---|---|
| Duplikált számla | Azonos számlaszám + összeg < 7 nap | CRITICAL |
| Áreltérés | > 30% az átlagárhoz képest | WARNING |
| Szokatlan időpont | 22:00 - 06:00 között | INFO |
| Készletforgás csökkenés | > 40% csökkenés 30 nap alatt | WARNING |
| Cash-flow kockázat | Előrejelzett negatív egyenleg < 14 nap | CRITICAL |

---

## 6. Technológia Stack

| Réteg | Technológia | Megjegyzés |
|---|---|---|
| Orkesztráció | n8n (self-hosted vagy cloud) | WF-6..WF-9 új workflow-ok |
| Kognitív motor | Langflow (self-hosted) | RAG láncok, ágens hierarchia |
| Vektortár | LanceDB (`data/brunella_lancedb/accounting_kb`) | Meglévő LanceDB mellé |
| LLM | Gemini Pro / GPT-4o (Brain) | Magas komplexitás → Cloud |
| LLM lokális | Ollama qwen2.5-coder:7b | Alacsony komplexitás |
| NAV API | REST v3.0 + XML parsing | n8n HTTP Request node |
| Értesítések | Gmail (n8n) + Slack webhook | Human-in-Loop jóváhagyás |
| Monitoring | LangSmith (traces) + n8n execution log | LLM trace telemetria |

---

## 7. Magyar Számviteli Törvény Kényszerek

A rendszer a következő jogszabályi keretrendszerben működik:

- **2000. évi C. törvény (Sztv.):** Kettős könyvvitel, egységes számlatükör, mérlegképes szabályok
- **Számlaosztályok algoritmizálva:**
  - 1: Befektetett eszközök (amortizáció elkülönítése)
  - 2: Készletek (FIFO / WAC — a készletkezelő track-kel szinkronban)
  - 3: Követelések, pénzeszközök
  - 4: Saját tőke, kötelezettségek (454 Szállítók)
  - 5/8: Költségnemek / Ráfordítások
  - 9: Árbevétel
- **NAV Online Számla v3.0:** Minden számla keresztellenőrzése az adóhatósági adatokkal

---

## 8. Biztonsági Követelmények

- MCP szerver csak hitelesített BAS session-ökkel kommunikál (RBAC)
- LanceDB-ben tárolt dokumentumokban partnernevek és bankszámlaszámok anonimizálva
- NAV API kulcs kizárólag n8n credential vault-ban tárolva, `.env`-ben TILOS
- Minden LLM hívás audit log-olva (`data/audit.db`)
- PII adatok (személynevek, adószámok) kizárólag hash-elt formában kerülnek az LLM-be
