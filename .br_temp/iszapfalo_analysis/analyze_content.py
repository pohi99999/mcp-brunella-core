import os, json, re
from collections import Counter, defaultdict
from pathlib import Path

GEM = Path(r"C:\Users\pohi9\OneDrive\Desktop\Gemini_cli")
ISZ = Path(r"C:\Users\pohi9\OneDrive\Desktop\Iszapfaló_Projekt_FO")
OUT = Path(r"F:\mcp-brunella-core\_br_temp\iszapfalo_analysis")
OUT.mkdir(parents=True, exist_ok=True)

keywords = ["airtable","n8n","workflow","telegram","calendar","error","claude","gemini","manus","projekt","késés","munkaidő"]


def safe_read_text(path: Path):
    for enc in ("utf-8","utf-8-sig","cp1250","latin1"):
        try:
            return path.read_text(encoding=enc)
        except Exception:
            continue
    return ""


def analyze_text(text: str):
    low = text.lower()
    return {k: low.count(k) for k in keywords}

# ---------- Iszapfaló docs ----------
isz_doc_files = []
workflow_files = []
for p in ISZ.rglob("*"):
    if not p.is_file():
        continue
    ext = p.suffix.lower()
    rel = str(p.relative_to(ISZ))
    if ext in {".md", ".txt", ".py"}:
        txt = safe_read_text(p)
        isz_doc_files.append({
            "path": rel,
            "size": p.stat().st_size,
            "type": ext,
            "lineCount": txt.count("\n") + 1 if txt else 0,
            "headings": [ln.strip() for ln in txt.splitlines() if ln.strip().startswith("#")][:12],
            "keywordHits": analyze_text(txt),
            "preview": txt[:1200]
        })
    elif ext == ".json":
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            try:
                data = json.loads(p.read_text(encoding="utf-8-sig"))
            except Exception:
                continue
        # n8n workflow detection
        if isinstance(data, dict) and ("nodes" in data or "connections" in data):
            nodes = data.get("nodes", []) if isinstance(data.get("nodes", []), list) else []
            node_types = Counter()
            triggers = []
            credentials = set()
            for n in nodes:
                if not isinstance(n, dict):
                    continue
                ntype = n.get("type") or "unknown"
                node_types[ntype] += 1
                if any(x in ntype.lower() for x in ["trigger","webhook","cron","telegramtrigger"]):
                    triggers.append(ntype)
                creds = n.get("credentials")
                if isinstance(creds, dict):
                    for ck in creds.keys():
                        credentials.add(ck)
            workflow_files.append({
                "path": rel,
                "size": p.stat().st_size,
                "name": data.get("name") if isinstance(data, dict) else None,
                "nodeCount": len(nodes),
                "nodeTypesTop": node_types.most_common(12),
                "triggers": sorted(set(triggers)),
                "credentials": sorted(credentials),
            })
        else:
            isz_doc_files.append({
                "path": rel,
                "size": p.stat().st_size,
                "type": ".json",
                "lineCount": None,
                "headings": [],
                "keywordHits": {},
                "preview": json.dumps(data, ensure_ascii=False)[:1200]
            })

# ---------- Gemini corpus ----------
gem_summary = {
    "jsonFiles": [],
    "txtToolCategoryCount": {},
    "txtToolCategoryBytes": {},
    "keywordHitsAcrossTxt": {},
}

# JSON files analysis
for p in GEM.glob("*.json"):
    info = {"path": p.name, "size": p.stat().st_size}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        info["topType"] = type(data).__name__
        if isinstance(data, dict):
            info["topKeys"] = list(data.keys())[:30]
            # best-effort size hints
            for k,v in list(data.items())[:15]:
                if isinstance(v, list):
                    info.setdefault("listSizes", {})[k] = len(v)
                elif isinstance(v, dict):
                    info.setdefault("dictSizes", {})[k] = len(v)
        elif isinstance(data, list):
            info["listLen"] = len(data)
            if data and isinstance(data[0], dict):
                info["itemKeysSample"] = list(data[0].keys())[:20]
    except Exception as e:
        info["parseError"] = str(e)
    gem_summary["jsonFiles"].append(info)

# txt files in session subdirs
cat_count = Counter()
cat_bytes = Counter()
kw_hits = Counter()
for p in GEM.rglob("*.txt"):
    rel = p.relative_to(GEM)
    # derive category from filename prefix (tool-ish)
    name = p.name
    category = name.split("_")[0] if "_" in name else "misc"
    cat_count[category] += 1
    size = p.stat().st_size
    cat_bytes[category] += size
    txt = safe_read_text(p)
    low = txt.lower()
    for k in keywords:
        c = low.count(k)
        if c:
            kw_hits[k] += c

gem_summary["txtToolCategoryCount"] = dict(cat_count.most_common())
gem_summary["txtToolCategoryBytes"] = dict(cat_bytes.most_common())
gem_summary["keywordHitsAcrossTxt"] = dict(kw_hits.most_common())

# ---------- Persist reports ----------
raw = {
    "iszapfalo": {
        "docFiles": sorted(isz_doc_files, key=lambda x: x["path"].lower()),
        "workflowFiles": sorted(workflow_files, key=lambda x: x["path"].lower()),
        "counts": {
            "docFiles": len(isz_doc_files),
            "workflowFiles": len(workflow_files),
        }
    },
    "gemini_cli": gem_summary
}

(OUT / "content_analysis_raw.json").write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")

# markdown summary
md = []
md.append("# Cross-folder Content Analysis (raw)\n")
md.append("## Iszapfaló_Projekt_FO\n")
md.append(f"- Dokumentum fájlok: **{len(isz_doc_files)}**\n")
md.append(f"- Workflow JSON fájlok: **{len(workflow_files)}**\n")
md.append("\n### Workflow inventory\n")
for w in sorted(workflow_files, key=lambda x: x["path"].lower()):
    md.append(f"- `{w['path']}` | name: `{w.get('name')}` | nodes: {w['nodeCount']} | triggers: {', '.join(w['triggers']) if w['triggers'] else 'n/a'} | creds: {', '.join(w['credentials']) if w['credentials'] else 'n/a'}")

md.append("\n### Strategic docs quick scan\n")
for d in sorted([x for x in isz_doc_files if x["type"] in {".md",".txt"}], key=lambda x: x["path"].lower()):
    if any(k in d["path"].lower() for k in ["spec", "plan", "osszefogl", "ezt_olvasd", "minimum", "vision", "manus", "meta", "requirements"]):
        md.append(f"- `{d['path']}` ({d['size']} B) keywords={d['keywordHits']}")

md.append("\n## Gemini_cli\n")
md.append(f"- JSON fájlok: **{len(gem_summary['jsonFiles'])}**\n")
md.append(f"- TXT session/tool-output fájlok: **{sum(gem_summary['txtToolCategoryCount'].values())}**\n")
md.append("\n### JSON files\n")
for j in sorted(gem_summary["jsonFiles"], key=lambda x: x["path"].lower()):
    md.append(f"- `{j['path']}` | type={j.get('topType')} | size={j['size']} | keys={j.get('topKeys', [])[:8]}")

md.append("\n### Top tool-output categories (by count)\n")
for k,v in list(gem_summary["txtToolCategoryCount"].items())[:20]:
    md.append(f"- {k}: {v}")

md.append("\n### Keyword hits across Gemini txt corpus\n")
for k,v in gem_summary["keywordHitsAcrossTxt"].items():
    md.append(f"- {k}: {v}")

(OUT / "content_analysis_summary.md").write_text("\n".join(md), encoding="utf-8")
print("done", OUT / "content_analysis_raw.json")
print("done", OUT / "content_analysis_summary.md")
