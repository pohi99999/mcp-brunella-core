# Spec: KKV CRM follow-up routing

Rövid: Automatikus routing logika, amely CRM lead eseményekből follow-up jobokat hoz létre (n8n vagy belső orchestrator használatával). Cél, hogy a sales/CS csapat időben kapjon follow-up feladatot a lead állapota és prioritása alapján.

## Kontextus
- Kiindulás: `kkv_crm_ingest_foundation_20260405` adataira épít (lead payload, dedupe, owner assignment)
- Célrendszerek: n8n webhook / belső orchestrator HTTP API `/api/v1/followups`

## Követelmények (REQ-XXX)

- REQ-001: Event-driven routing — ha lead változik (new/updated) és teljesíti a routing szabályokat, hozzon létre follow-up jobot. (Acceptance: end-to-end teszt automatikusan létrehoz followup jobot)
- REQ-002: Idempotencia — ugyanazon esemény többszöri küldése ne duplikáljon follow-upot (Acceptance: dedupe token vagy event-id check használatával)
- REQ-003: Biztonság — webhook hitelesítése (HMAC vagy shared secret) kötelező; az orchestrator API tokennel védett. (Acceptance: invalid signature → 401)
- REQ-004: Routing szabályok konfigurálhatóak (lead.source, lead.priority, last_activity_days, owner). (Acceptance: runtime config változtatás hatása azonnal működik)
- REQ-005: Observability — minden routed esemény logolva és metrikázva (success, failure, duplicate). (Acceptance: alap metrikák létrejönnek)
- REQ-006: Fallback & Retry — ha follow-up creation sikertelen, 3 retries backoff; végső failure → alert (Acceptance: retry logikát tesztelve)

## Assumptions
- CRM payload tartalmaz legalább: `lead_id`, `email`, `status`, `source`, `priority`, `last_activity_at`, `owner_id`, `event_id` (vagy webhook id)
- Van egy belső API endpoint: `POST /api/v1/followups` amely elfogad `lead_id`, `owner_id`, `due_date`, `note`, `source`.

## Non-goals
- Automatikus személyes üzenetküldés (SMS/Email) — csak follow-up job létrehozás
