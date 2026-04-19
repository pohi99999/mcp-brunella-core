"""
Heti Kontextus Csomag workflow JSON generátor
Iszapfaló Kft - n8n automatizáció
2026-05
"""
import json

# Kód node tartalmak (Python stringként könnyebb írni, majd json.dumps escapeli)

CODE_INIT = """
const now = new Date();
const dayOfWeek = now.getDay(); // 0=vasárnap
const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
const hetKezdete = new Date(now);
hetKezdete.setDate(now.getDate() - daysToMonday);
hetKezdete.setHours(0, 0, 0, 0);
const hetKezdeteStr = hetKezdete.toISOString().slice(0, 10);

const hun_days = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const hun_months = ['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
const maiNap = now.getFullYear() + '. ' + hun_months[now.getMonth()] + ' ' + now.getDate() + '. (' + hun_days[now.getDay()] + ')';

// ⚠️ BEÁLLÍTANDÓ: Gergő Telegram Chat ID-ját add meg itt!
// Hogyan tudod meg: /start üzenetet küldeni a Brunella botnak, majd másold ki a chat_id értéket.
const gergo_chat_id = 'BEALLITANDO_GERGO_TELEGRAM_ID';

return [{json: {
  gergo_chat_id: gergo_chat_id,
  het_kezdete: hetKezdeteStr,
  mai_nap: maiNap
}}];
""".strip()

CODE_OSSZESITES = """
// ========== ADATOK LEKÉRÉSE ==========
const initData = $('Code - Inicializálás').first().json;
const chatId = initData.gergo_chat_id;
const maiNap = initData.mai_nap;
const hetKezdete = initData.het_kezdete;

const folyRaw = $('HTTP - Aktív Folyamatok').first().json;
const folyamatok = (folyRaw.records || []).filter(function(f) {
  return f.fields && f.fields['Folyamat neve'];
});

const feladRaw = $('HTTP - Prioritásos Feladatok').first().json;
const feladatok = feladRaw.records || [];

const munkRaw = $input.first().json;
const munkaidok = (munkRaw.records || []).filter(function(m) {
  if (!m.fields || !m.fields['Dátum']) return false;
  return m.fields['Dátum'] >= hetKezdete;
});

// ========== KATEGORIZÁLÁS ==========
const magasPrio = feladatok.filter(function(f) {
  return f.fields && f.fields['Prioritás'] === 'Magas' &&
         f.fields['Státusz'] !== 'Befejezve' && f.fields['Státusz'] !== 'Kész';
});

const hamarLejaro = feladatok.filter(function(f) {
  if (!f.fields || !f.fields['Határidő']) return false;
  const hat = new Date(f.fields['Határidő']);
  const diff = (hat - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= -1 && diff <= 7;
});

const folyamatban = feladatok.filter(function(f) {
  return f.fields && f.fields['Státusz'] === 'Folyamatban';
});

let osszesMunkaora = 0;
munkaidok.forEach(function(m) {
  osszesMunkaora += parseFloat(m.fields['Ledolgozott Órák'] || 0);
});

// ========== ÜZENET ÖSSZEÁLLÍTÁSA ==========
let msg = '📊 *HETI KONTEXTUS CSOMAG*\\n';
msg += '_' + maiNap + '_\\n\\n';

// --- FOLYAMATOK ---
msg += '🏗️ *AKTÍV FOLYAMATOK (' + folyamatok.length + ' db)*\\n';
if (folyamatok.length === 0) {
  msg += '_Nincs aktív folyamat_\\n';
} else {
  folyamatok.slice(0, 10).forEach(function(f) {
    const nev = f.fields['Folyamat neve'];
    const statusz = f.fields['Státusz'] || '?';
    const hat = f.fields['Határidő'] ? ' 📅 ' + f.fields['Határidő'] : '';
    const ar = f.fields['Kiajánlott Ár (nettó)']
      ? ' 💰 ' + Math.round(f.fields['Kiajánlott Ár (nettó)']).toLocaleString('hu-HU') + ' Ft'
      : '';
    msg += '• ' + nev + ' — ' + statusz + hat + ar + '\\n';
  });
  if (folyamatok.length > 10) {
    msg += '  _...és még ' + (folyamatok.length - 10) + ' további_\\n';
  }
}
msg += '\\n';

// --- FELADATOK ---
msg += '⚡ *AKTUÁLIS FELADATOK*\\n';
let vanFeladat = false;

if (magasPrio.length > 0) {
  vanFeladat = true;
  msg += '🔴 *Magas prioritású (' + magasPrio.length + ' db):*\\n';
  magasPrio.slice(0, 5).forEach(function(f) {
    const nev = f.fields['Feladat neve'] || '?';
    const statusz = f.fields['Státusz'] || '?';
    const hat = f.fields['Határidő'] ? ' ⏰ ' + f.fields['Határidő'].slice(0, 10) : '';
    msg += '  • ' + nev + ' [' + statusz + ']' + hat + '\\n';
  });
}

if (hamarLejaro.length > 0) {
  vanFeladat = true;
  msg += '⏳ *7 napon belül lejár (' + hamarLejaro.length + ' db):*\\n';
  hamarLejaro.slice(0, 5).forEach(function(f) {
    const nev = f.fields['Feladat neve'] || '?';
    const hat = f.fields['Határidő'] ? f.fields['Határidő'].slice(0, 10) : '?';
    msg += '  • ' + nev + ' — ' + hat + '\\n';
  });
}

if (folyamatban.length > 0) {
  vanFeladat = true;
  msg += '🔵 *Folyamatban (' + folyamatban.length + ' db):*\\n';
  folyamatban.slice(0, 5).forEach(function(f) {
    const nev = f.fields['Feladat neve'] || '?';
    msg += '  • ' + nev + '\\n';
  });
}

if (!vanFeladat) {
  msg += '_Nincs sürgős feladat 🎉_\\n';
}
msg += '\\n';

// --- MUNKAIDŐ ---
msg += '⏱️ *HETI MUNKAIDŐ* (' + hetKezdete + ' — ma)\\n';
if (munkaidok.length === 0) {
  msg += '_Még nincs munkaidő bejegyzés erre a hétre_\\n';
} else {
  msg += '📌 Bejegyzések: ' + munkaidok.length + ' nap | Összes: *' + osszesMunkaora.toFixed(1) + ' óra*\\n';
  munkaidok.slice(0, 7).forEach(function(m) {
    const datum = m.fields['Dátum'] || '?';
    const ora = m.fields['Ledolgozott Órák'] || 0;
    const tipus = m.fields['Nap Típusa'] ? ' [' + m.fields['Nap Típusa'] + ']' : '';
    const projekt = m.fields['Projekt'] ? ' — ' + m.fields['Projekt'] : '';
    msg += '  • ' + datum + ': ' + ora + 'h' + tipus + projekt + '\\n';
  });
}
msg += '\\n';

msg += '💡 _BAS Automatikus Jelentés — Brunella_';

return [{json: {message: msg, chatId: chatId}}];
""".strip()

# ========== WORKFLOW DEFINÍCIÓ ==========

workflow = {
    "name": "Iszapfaló - Heti Kontextus Csomag",
    "nodes": [
        {
            "id": "6f8a2b1c-0001-4abc-8def-a00000000001",
            "name": "Hétfői Trigger",
            "type": "n8n-nodes-base.cron",
            "typeVersion": 1,
            "position": [0, 300],
            "parameters": {
                "triggerTimes": {
                    "item": [{"mode": "custom", "cronExpression": "0 8 * * 1"}]
                }
            }
        },
        {
            "id": "6f8a2b1c-0002-4abc-8def-a00000000002",
            "name": "Code - Inicializálás",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [220, 300],
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": CODE_INIT
            }
        },
        {
            "id": "6f8a2b1c-0003-4abc-8def-a00000000003",
            "name": "HTTP - Aktív Folyamatok",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [440, 300],
            "parameters": {
                "method": "GET",
                "url": "https://api.airtable.com/v0/appU3xQMuAmpmmCEy/tblvF6O9evfV0bPfX",
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "airtableTokenApi",
                "sendQuery": True,
                "queryParameters": {
                    "parameters": [
                        {"name": "maxRecords", "value": "30"},
                        {"name": "sort[0][field]", "value": "Határidő"},
                        {"name": "sort[0][direction]", "value": "asc"}
                    ]
                },
                "options": {}
            },
            "credentials": {
                "airtableTokenApi": {
                    "id": "c0DCvOcS3pwQNv2V",
                    "name": "Airtable Personal Access Token account"
                }
            }
        },
        {
            "id": "6f8a2b1c-0004-4abc-8def-a00000000004",
            "name": "HTTP - Prioritásos Feladatok",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [660, 300],
            "parameters": {
                "method": "GET",
                "url": "https://api.airtable.com/v0/appU3xQMuAmpmmCEy/tblyKWVbamAr32hWm",
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "airtableTokenApi",
                "sendQuery": True,
                "queryParameters": {
                    "parameters": [
                        {"name": "filterByFormula", "value": "OR({Státusz}='Folyamatban',{Prioritás}='Magas',AND(NOT({Határidő}=''),IS_BEFORE({Határidő},DATEADD(TODAY(),8,'days'))))"},
                        {"name": "maxRecords", "value": "30"},
                        {"name": "sort[0][field]", "value": "Prioritás"},
                        {"name": "sort[0][direction]", "value": "desc"},
                        {"name": "sort[1][field]", "value": "Határidő"},
                        {"name": "sort[1][direction]", "value": "asc"}
                    ]
                },
                "options": {}
            },
            "credentials": {
                "airtableTokenApi": {
                    "id": "c0DCvOcS3pwQNv2V",
                    "name": "Airtable Personal Access Token account"
                }
            }
        },
        {
            "id": "6f8a2b1c-0005-4abc-8def-a00000000005",
            "name": "HTTP - Heti Munkaidő",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [880, 300],
            "parameters": {
                "method": "GET",
                "url": "https://api.airtable.com/v0/appU3xQMuAmpmmCEy/tblVLekXRPVHUxvsh",
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "airtableTokenApi",
                "sendQuery": True,
                "queryParameters": {
                    "parameters": [
                        {"name": "filterByFormula", "value": "IS_AFTER({Dátum}, DATEADD(TODAY(), -14, 'days'))"},
                        {"name": "maxRecords", "value": "50"},
                        {"name": "sort[0][field]", "value": "Dátum"},
                        {"name": "sort[0][direction]", "value": "desc"}
                    ]
                },
                "options": {}
            },
            "credentials": {
                "airtableTokenApi": {
                    "id": "c0DCvOcS3pwQNv2V",
                    "name": "Airtable Personal Access Token account"
                }
            }
        },
        {
            "id": "6f8a2b1c-0006-4abc-8def-a00000000006",
            "name": "Code - Kontextus Összesítés",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1100, 300],
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": CODE_OSSZESITES
            }
        },
        {
            "id": "6f8a2b1c-0007-4abc-8def-a00000000007",
            "name": "Telegram - Küldés Gergőnek",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [1320, 300],
            "parameters": {
                "chatId": "={{ $json.chatId }}",
                "text": "={{ $json.message }}",
                "additionalFields": {
                    "parse_mode": "Markdown"
                }
            },
            "credentials": {
                "telegramApi": {
                    "id": "Z5xPHNqsZKTxTYb6",
                    "name": "Telegram account"
                }
            }
        }
    ],
    "connections": {
        "Hétfői Trigger": {
            "main": [[{"node": "Code - Inicializálás", "type": "main", "index": 0}]]
        },
        "Code - Inicializálás": {
            "main": [[{"node": "HTTP - Aktív Folyamatok", "type": "main", "index": 0}]]
        },
        "HTTP - Aktív Folyamatok": {
            "main": [[{"node": "HTTP - Prioritásos Feladatok", "type": "main", "index": 0}]]
        },
        "HTTP - Prioritásos Feladatok": {
            "main": [[{"node": "HTTP - Heti Munkaidő", "type": "main", "index": 0}]]
        },
        "HTTP - Heti Munkaidő": {
            "main": [[{"node": "Code - Kontextus Összesítés", "type": "main", "index": 0}]]
        },
        "Code - Kontextus Összesítés": {
            "main": [[{"node": "Telegram - Küldés Gergőnek", "type": "main", "index": 0}]]
        }
    },
    "active": False,
    "settings": {
        "executionOrder": "v1"
    },
    "tags": [],
    "meta": {
        "description": "Hétfő reggeli Kontextus Csomag - Aktív folyamatok, feladatok, munkaidő összesítő Telegram üzenet Gergőnek.\n\n⚠️ BEÁLLÍTANDÓ: Code - Inicializálás node-ban a gergo_chat_id értéket add meg!"
    }
}

# JSON fájl mentése
output_path = r"F:\mcp-brunella-core\_br_temp\heti_kontextus_csomag.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, ensure_ascii=False, indent=2)

print(f"✅ Workflow JSON elkészítve: {output_path}")
print(f"   Nodes: {len(workflow['nodes'])}")
print(f"   Connections: {len(workflow['connections'])}")

# Validáljuk a JSON-t visszaolvasással
with open(output_path, 'r', encoding='utf-8') as f:
    check = json.load(f)
print(f"✅ JSON validáció OK - {len(json.dumps(check))} byte")
print()
print("📋 Node lista:")
for n in check['nodes']:
    print(f"   {n['name']:45s} [{n['type']}]")

print()
print("⚠️  TEENDŐK BEFORE ACTIVATION:")
print("   1. n8n-be importálni ezt a JSON-t")
print("   2. Code - Inicializálás node-ban beállítani: gergo_chat_id = Gergő valódi Telegram Chat ID-ja")
print("   3. Aktiválni a workflow-t")
