import json, re
from pathlib import Path
from collections import defaultdict, Counter

BASE = Path(r"F:\mcp-brunella-core\_br_temp\iszapfalo_analysis")
RAW = BASE / "content_analysis_raw.json"
OUT_MAP = BASE / "canonical_release_map.md"
OUT_JSON = BASE / "canonical_release_map.json"
OUT_CHECK = BASE / "go_live_checklist.md"

raw = json.loads(RAW.read_text(encoding="utf-8"))
workflows = raw["iszapfalo"]["workflowFiles"]


def canonical_key(path, name):
    # prefer workflow name, fallback to filename stem cleaned
    src = (name or Path(path).stem or "").lower()
    src = src.replace("→", "->")
    src = src.replace("_", " ")
    src = src.replace("(v2 - javított)", "v2")
    src = re.sub(r"\([^\)]*\)", "", src)
    src = re.sub(r"[^a-z0-9áéíóöőúüű\-\s/]", " ", src)
    src = re.sub(r"\s+", " ", src).strip()

    aliases = {
        "feladatok státuszállítás telegram chat": "feladat_status_telegram",
        "iszapfaló telegram parancsok /statusz /het": "telegram_parancsok",
        "iszapfaló telegram parancsok": "telegram_parancsok",
        "airtable google calendar feladat készítő": "airtable_calendar_feladat",
        "iszapfaló google calendar -> airtable szinkron": "calendar_airtable_szinkron",
        "iszapfaló heti emlékeztető": "heti_emlekezteto",
        "telegram hangvezérlés teljes rendszer": "telegram_hangvezerles",
        "kimenő ajánlatok/dokumentumok": "kimeno_ajanlatok_dokumentumok",
        "gmail kategorizáló": "gmail_kategorizalo",
        "iszapfaló ai agent asszisztens v2": "ai_agent_asszisztens_v2",
        "iszapfaló error monitoring és logging": "error_monitoring_logging",
        "iszapfaló prediktív karbantartás": "geppark_karbantartas",
        "ai agent workflow": "ai_agent_workflow_proto",
        "my workflow": "misc_workflow_proto",
    }
    for a,k in aliases.items():
        if a in src:
            return k

    # filename fallback matching
    p = path.lower()
    if "gmail kategoriz" in p:
        return "gmail_kategorizalo"
    if "error monitoring" in p:
        return "error_monitoring_logging"
    if "ai agent asszisztens" in p:
        return "ai_agent_asszisztens_v2"
    if "telegram parancsok" in p:
        return "telegram_parancsok"
    if "heti emlekezt" in p or "heti emlékezt" in p:
        return "heti_emlekezteto"
    if "geppark" in p:
        return "geppark_karbantartas"
    if "airtable" in p and "calendar" in p and "feladat" in p:
        return "airtable_calendar_feladat"
    if "calendar" in p and "szinkron" in p:
        return "calendar_airtable_szinkron"
    if "kimenő ajánlatok" in p or "kimeno" in p:
        return "kimeno_ajanlatok_dokumentumok"

    return src[:80] or "unknown"


def source_rank(path):
    p = path.lower()
    # lower is better
    if "import_ready_pack_2026_03_13" in p:
        return 1
    if "implemented_2026_03_13" in p:
        return 2
    if "importra_kesz" in p:
        return 3
    if "1. legfontosabb" in p:
        return 4
    if "mi csináltuk workflow" in p:
        return 5
    return 9

# group workflows
by_key = defaultdict(list)
for w in workflows:
    key = canonical_key(w.get("path",""), w.get("name"))
    by_key[key].append(w)

canonical = []
for key, items in by_key.items():
    # choose best candidate by source rank, then more nodes, then smaller path length
    sorted_items = sorted(items, key=lambda x: (source_rank(x["path"]), -x.get("nodeCount",0), len(x["path"])))
    chosen = sorted_items[0]
    canonical.append({
        "canonicalKey": key,
        "chosen": chosen,
        "alternatives": sorted_items[1:],
        "sourceRank": source_rank(chosen["path"]),
    })

canonical = sorted(canonical, key=lambda x: (x["sourceRank"], x["canonicalKey"]))

# Save JSON
OUT_JSON.write_text(json.dumps(canonical, ensure_ascii=False, indent=2), encoding="utf-8")

# Build markdown map
lines = []
lines.append("# Iszapfaló Canonical Release Map (workflow-konszolidáció)")
lines.append("")
lines.append("## Döntési szabály")
lines.append("- Elsődleges jelölt: `IMPORT_READY_PACK_2026_03_13`")
lines.append("- Másodlagos: `IMPLEMENTED_2026_03_13 n8n workflow`")
lines.append("- Harmadlagos: `IMPORTRA_KESZ`")
lines.append("- Továbbiak: forrás / prototípus jelleg")
lines.append("")
lines.append("## Kanonikus workflow lista")
lines.append("")
for i, c in enumerate(canonical, start=1):
    ch = c["chosen"]
    lines.append(f"### {i}. {c['canonicalKey']}")
    lines.append(f"- **Chosen path:** `{ch['path']}`")
    lines.append(f"- Nodes: {ch.get('nodeCount')} | Triggers: {', '.join(ch.get('triggers',[])) or 'n/a'}")
    lines.append(f"- Credentials: {', '.join(ch.get('credentials',[])) or 'n/a'}")
    if c["alternatives"]:
        lines.append("- Alternative versions:")
        for a in c["alternatives"]:
            lines.append(f"  - `{a['path']}` (nodes={a.get('nodeCount')})")
    else:
        lines.append("- Alternative versions: nincs")
    lines.append("")

# simple risk section
lines.append("## Azonnali kockázati jelölések")
lines.append("- Több workflow név több forrásban is szerepel, kötelező a kanonikus lista alapján importálni.")
lines.append("- A `credentials: n/a` jelölésű workflow-knál az import után manuális credential bekötés ellenőrzendő.")
lines.append("- JSON-ban `name: None` jelölésű exportok (főleg IMPORTRA_KESZ) esetén névstandardizálás javasolt az n8n-ben.")

OUT_MAP.write_text("\n".join(lines), encoding="utf-8")

# Build go-live checklist
check = []
check.append("# Iszapfaló Go-Live Import & Teszt Checklist")
check.append("")
check.append("## A) Előkészítés")
check.append("- [ ] n8n backup/export készítve a jelenlegi állapotról")
check.append("- [ ] Airtable Base ID validálva minden importálandó workflow-ban: `appU3xQMuAmpmmCEy`")
check.append("- [ ] Credential inventory rendelkezésre áll (Telegram, Airtable, Anthropic, OpenAI, Google Calendar, Gmail, Google Drive)")
check.append("- [ ] Hardcoded kulcsok eltávolítva script-ekből (env változókra áttéve)")
check.append("")
check.append("## B) Import sorrend (kanonikus)")
prio = [
    "error_monitoring_logging",
    "gmail_kategorizalo",
    "ai_agent_asszisztens_v2",
    "telegram_parancsok",
    "geppark_karbantartas",
    "heti_emlekezteto",
]
for p in prio:
    found = next((x for x in canonical if x["canonicalKey"]==p), None)
    if found:
        check.append(f"- [ ] `{p}` → import from: `{found['chosen']['path']}`")
check.append("")
check.append("## C) Kötelező post-import validáció")
check.append("- [ ] Workflow név, active state és trigger helyes")
check.append("- [ ] Minden node credential hozzárendelve")
check.append("- [ ] Airtable táblák léteznek: MUNKAK, KOLTSEGEK, SZABADSAGOK, Munkaidő Nyilvántartás")
check.append("- [ ] Telegram `/statusz` és `/het` dátumszűrők ellenőrizve")
check.append("- [ ] Gmail kategorizáló parser/model binding hibamentes")
check.append("")
check.append("## D) Acceptance tesztek")
check.append("- [ ] Telegram: 'Kezdem a munkát' → munkaidő rekord létrejön")
check.append("- [ ] Telegram: '5000 Ft üzemanyag' → költség rekord létrejön")
check.append("- [ ] `/statusz` → napi adat visszajön")
check.append("- [ ] `/het` → heti összegzés visszajön")
check.append("- [ ] Gmail tesztmail feldolgozása és Airtable lekövetése")
check.append("- [ ] Error monitoring riasztás tesztelve")

OUT_CHECK.write_text("\n".join(check), encoding="utf-8")

print("generated:", OUT_MAP)
print("generated:", OUT_JSON)
print("generated:", OUT_CHECK)
