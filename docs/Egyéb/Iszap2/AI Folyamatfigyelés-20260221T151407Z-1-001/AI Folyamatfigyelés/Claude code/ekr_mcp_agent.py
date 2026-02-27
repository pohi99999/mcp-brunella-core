#!/usr/bin/env python3
"""
EKR MCP-alapú Autonomous Search Agent
Használja a Claude in Chrome MCP connectort - nincs szükség SMS kódra!

Használat:
    python3 ekr_mcp_agent.py

Előfeltétel:
    - Légy bejelentkezve az EKR-be a böngészőben
    - Claude Code CLI futtatása
"""

import json
import time
from datetime import datetime
from typing import Dict, List


class EKRMCPAgent:
    """EKR keresési ügynök MCP connector használatával."""

    def __init__(self):
        self.session_id = datetime.now().strftime("%Y-%m-%d_%H-%M")
        self.search_log = {
            "search_session": {
                "session_id": self.session_id,
                "start_time": datetime.now().isoformat(),
                "strategy": "AI-vezérelt EKR Keresési Stratégia - MCP verzió",
                "status": "running",
            },
            "search_results": [],
            "pending_searches": [],
            "performance_metrics": {}
        }

        # Keresési stratégia
        self.search_strategy = {
            "magas_prioritas": {
                "kategoria": "Alaptevékenység",
                "kulcsszavak": [
                    "iszapkotrás",
                    "mederkotrás",
                    "tókotrás",
                    "kotrás",
                    "csapadékvíz",
                    "vízrendezés",
                    "vízépítés",
                    "iszapkezelés",
                    "víztelenített iszap"
                ]
            }
        }

    def execute_search_strategy(self):
        """
        Keresési stratégia végrehajtása.

        MEGJEGYZÉS: Ez a függvény csak a keresési logikát tartalmazza.
        A tényleges böngésző vezérlés Claude Code CLI-n keresztül történik.
        """
        print(f"\n🎯 Keresési stratégia végrehajtása")

        strategy = self.search_strategy["magas_prioritas"]
        keywords = strategy["kulcsszavak"]
        category = strategy["kategoria"]

        print(f"\n📋 Tervezett keresések: {len(keywords)} kulcsszó")
        print(f"📂 Kategória: {category}")
        print(f"\nKulcsszavak:")
        for idx, keyword in enumerate(keywords, 1):
            print(f"  {idx}. {keyword}")

        print(f"\n⚠️  FONTOS:")
        print(f"Ez a verzió Claude Code CLI-ből fut automatikusan.")
        print(f"A böngésző vezérlés az MCP connector-on keresztül történik.")

        return keywords

    def log_search_result(self, keyword: str, results_count: int, url: str):
        """Keresési eredmény naplózása."""
        result = {
            "search_id": len(self.search_log["search_results"]) + 1,
            "keyword": keyword,
            "priority": "magas",
            "category": "Alaptevékenység",
            "results_count": results_count,
            "url": url,
            "timestamp": datetime.now().isoformat(),
            "status": "completed"
        }
        self.search_log["search_results"].append(result)
        print(f"✅ {keyword}: {results_count} találat")

    def calculate_performance_metrics(self):
        """Teljesítmény metrikák számítása."""
        total_planned = len(self.search_strategy["magas_prioritas"]["kulcsszavak"])
        completed = len(self.search_log["search_results"])
        total_results = sum(
            r.get("results_count", 0)
            for r in self.search_log["search_results"]
        )

        coverage = (completed / total_planned * 100) if total_planned > 0 else 0

        self.search_log["performance_metrics"] = {
            "total_searches_planned": total_planned,
            "searches_completed": completed,
            "total_results_found": total_results,
            "coverage_percentage": round(coverage, 2),
            "estimated_completion": "completed" if coverage == 100 else "in_progress"
        }

    def generate_reports(self):
        """JSON és Markdown riportok generálása."""
        print("\n📝 Riportok generálása...")

        # JSON riport
        self.search_log["search_session"]["end_time"] = datetime.now().isoformat()
        self.search_log["search_session"]["status"] = "completed"

        json_filename = f"ekr_mcp_search_{self.session_id}.json"
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(self.search_log, f, ensure_ascii=False, indent=2)
        print(f"✅ JSON riport: {json_filename}")

        # Markdown riport
        md_filename = f"ekr_mcp_report_{self.session_id}.md"
        md_content = self._generate_markdown_report()
        with open(md_filename, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"✅ Markdown riport: {md_filename}")

    def _generate_markdown_report(self) -> str:
        """Markdown riport generálása."""
        metrics = self.search_log["performance_metrics"]
        results = self.search_log["search_results"]

        md = f"""# EKR MCP Keresési Riport

**Session ID**: {self.session_id}
**Dátum**: {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Módszer**: Claude in Chrome MCP Connector
**Státusz**: ✅ BEFEJEZVE

## 📊 Összesítés

- **Tervezett keresések**: {metrics['total_searches_planned']}
- **Végrehajtott keresések**: {metrics['searches_completed']}
- **Összes találat**: {metrics['total_results_found']:,}
- **Lefedettség**: {metrics['coverage_percentage']}%

## 🔍 Részletes Eredmények

| # | Kulcsszó | Találatok | URL |
|---|----------|-----------|-----|
"""
        for r in results:
            md += f"| {r['search_id']} | {r['keyword']} | {r.get('results_count', 'N/A'):,} | [Link]({r['url']}) |\n"

        md += f"""
---

**Generálva**: EKR MCP Agent (Claude Code CLI)
**Verzió**: 3.0 - MCP Connector alapú
"""
        return md

    def print_summary(self):
        """Összefoglaló kiírása."""
        metrics = self.search_log["performance_metrics"]

        print("\n" + "="*60)
        print("📊 VÉGLEGES ÖSSZEFOGLALÓ")
        print("="*60)
        print(f"✅ Végrehajtott keresések: {metrics['searches_completed']}/{metrics['total_searches_planned']}")
        print(f"🎯 Összes találat: {metrics['total_results_found']:,}")
        print(f"📈 Lefedettség: {metrics['coverage_percentage']}%")
        print("="*60)


if __name__ == "__main__":
    print("⚠️  Ez a script Claude Code CLI-ből fut automatikusan!")
    print("⚠️  Használd a Claude Code CLI-t az automatikus futtatáshoz.")
    print("\nHa manuálisan szeretnéd futtatni:")
    print("  1. Lépj be az EKR-be a böngészőben")
    print("  2. Indítsd el Claude Code CLI-t")
    print("  3. Kérd meg Claude-ot a keresés végrehajtására")

    agent = EKRMCPAgent()
    keywords = agent.execute_search_strategy()

    print(f"\n✅ Agent inicializálva")
    print(f"✅ {len(keywords)} kulcsszó előkészítve")
    print(f"\n💡 Használd Claude Code CLI-t a tényleges keresés végrehajtásához!")
