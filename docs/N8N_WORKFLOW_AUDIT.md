# n8n Cloud Workflow Audit & Javítások

**n8n Cloud URL:** https://iszapfalo.app.n8n.cloud  
**n8n verzió:** 1.123.22  
**Utolsó audit dátuma:** 2026-06-16

---

## Workflow-k Áttekintése (15 db)

### Aktív (10)
| # | Név | ID | Státusz |
|---|-----|----|---------|
| 01 | Error Monitoring | - | ✅ Aktív |
| 02 | AI Agent Munkaidő | - | ✅ Aktív |
| 03 | Telegram Commands | - | ✅ Aktív |
| 04 | Weekly Reminder | - | ✅ Aktív |
| 05 | Geppark | - | ✅ Aktív |
| 06 | ISZ Gmail Categorizel | LGvkbQNUm44UEoMi | ✅ Aktív (JAVÍTVA) |
| - | Google Calendar Szinkron | - | ✅ Aktív |
| - | Heti Emlékeztető | - | ✅ Aktív |
| - | Airtable-Google Calendar | - | ✅ Aktív |
| - | Feladatok státuszállítás | - | ✅ Aktív |

### Inaktív (5)
| Név | Státusz |
|-----|---------|
| Gmail kategorizáló (old) | ❌ Inaktív |
| Telegram Hangvezérlés | ❌ Inaktív |
| Okos Ajánlat Asszisztens | ❌ Inaktív |
| Prediktív Karbantartás | ❌ Inaktív |
| Munkaidő nyilvántartás | ❌ Inaktív |

---

## 06 - ISZ Gmail Categorizel - JAVÍTÁS (2026-06-16)

### Probléma
8 Gmail node (space-elnevezésű duplikátumok) credential nélkül volt, ami a workflow hibás működését okozta.

### Érintett Node-ok (javítva: 8 db)
| Node név | Típus | Javítás |
|----------|-------|---------|
| Gmail Trigger | gmailTrigger | ✅ Credential hozzáadva |
| Get many labels | gmail | ✅ Credential hozzáadva |
| Címkék | gmail | ✅ Credential hozzáadva |
| Add label to message | gmail | ✅ Credential hozzáadva |
| Get many labels1 | gmail | ✅ Credential hozzáadva |
| Címkék1 | gmail | ✅ Credential hozzáadva |
| Add label to message1 | gmail | ✅ Credential hozzáadva |
| Get many messages | gmail | ✅ Credential hozzáadva |

### Már meglévő (eredeti) Node-ok (8 db - ezek rendben voltak)
| Node név | Típus |
|----------|-------|
| Gmail_Trigger | gmailTrigger |
| Get_many_labels | gmail |
| Cmkk | gmail |
| Add_label_to_message | gmail |
| Get_many_labels1 | gmail |
| Cmkk1 | gmail |
| Add_label_to_message1 | gmail |
| Get_many_messages | gmail |

### Credential Összegzés (Workflow 06)
| Szolgáltatás | Credential név | ID | Node-ok száma |
|-------------|----------------|-----|---------------|
| Gmail OAuth2 | Gmail account 4 | 9yx6t71JVnl0hDva | 16 |
| Anthropic API | ISZ_Anthropic_Prod | odOgwQzht6VFn3Gw | 14 |
| Telegram API | ISZ_Telegram_Prod | XkjqRpMaHKDFOO3C | 6 |
| Airtable Token | ISZ_Airtable_Prod | OLUAFTjZT0aSEj6H | 4 |

### Anthropic Modellek
- 13/14 node: `claude-3-5-sonnet-20240620`
- 1/14 node: `claude-3-5-sonnet-latest`

### Technikai Részletek
- **Mentés módja:** REST API PATCH `/rest/workflows/LGvkbQNUm44UEoMi`
- **Régi versionId:** `71d452c7-3980-4d73-afe4-0aafe7084a43`
- **Új versionId:** `ff83b65b-b5af-4856-974e-6cd543e97165`
- **Mentés verifikálva:** Page reload után REST API GET-tel megerősítve, mind a 16 Gmail node rendelkezik credential-lel

### Tanulságok
- n8n Cloud REST API **PATCH** metódust használ workflow frissítésre (nem PUT!)
- `browser-id` header szükséges a `localStorage` `n8n-browserId` kulcsából
- httpOnly cookie-k csak page navigation-nel frissülnek
- `credentials: 'include'` kötelező a fetch hívásoknál
