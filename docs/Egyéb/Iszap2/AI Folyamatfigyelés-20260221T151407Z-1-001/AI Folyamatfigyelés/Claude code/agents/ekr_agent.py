#!/usr/bin/env python3
"""
EKR Agent - Elektronikus Közbeszerzési Rendszer monitoring
Iszapfaló Kft. számára - Vízépítés és iszapkotrás tenderek

Használat Claude Code-ból:
    "EKR" - Alapértelmezett keresés (csak aktív tenderek)
    "EKR --all" - Minden tender (aktív + lezárt)
    "EKR --keyword iszapkotrás" - Egyedi kulcsszó

Vagy parancsssorból:
    python agents/ekr_agent.py
    python agents/ekr_agent.py --username EMAIL --password PASS
    python agents/ekr_agent.py --all
"""

import json
import time
import os
from datetime import datetime
from typing import Dict, List, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys


class EKRAgent:
    """
    EKR (Elektronikus Közbeszerzési Rendszer) monitoring ügynök.

    Funkciók:
    - Automatikus belépés (SMS kód szükséges)
    - Kulcsszavas keresés több kategóriában
    - Csak aktív tenderek szűrése (alapértelmezett)
    - JSON + Markdown riportok
    - Teljes naplózás
    """

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        only_active: bool = True,
        custom_keywords: Optional[List[str]] = None
    ):
        """
        Args:
            username: EKR felhasználónév (email)
            password: EKR jelszó
            only_active: Ha True, csak aktív tendereket keres (alapértelmezett)
            custom_keywords: Egyedi kulcsszavak listája (opcionális)
        """
        self.username = username or os.getenv("EKR_USERNAME")
        self.password = password or os.getenv("EKR_PASSWORD")
        self.only_active = only_active
        self.base_url = "https://ekr.gov.hu"
        self.driver: Optional[webdriver.Chrome] = None
        self.session_id = datetime.now().strftime("%Y-%m-%d_%H-%M")

        # Munkamenet log inicializálása
        self.search_log = {
            "search_session": {
                "session_id": self.session_id,
                "start_time": datetime.now().isoformat(),
                "strategy": f"EKR Agent - {'Csak aktív tenderek' if only_active else 'Minden tender'}",
                "status": "running",
                "only_active": only_active
            },
            "search_results": [],
            "performance_metrics": {}
        }

        # Keresési stratégia - Iszapfaló Kft. specifikus
        if custom_keywords:
            self.search_strategy = {
                "egyedi": {
                    "kategoria": "Egyedi keresés",
                    "kulcsszavak": custom_keywords
                }
            }
        else:
            self.search_strategy = {
                "magas_prioritas": {
                    "kategoria": "Alaptevékenység - Iszapkotrás és Vízépítés",
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
                },
                "kozepes_prioritas": {
                    "kategoria": "Kapcsolódó tevékenység",
                    "kulcsszavak": [
                        "vízfolyás karbantartás",
                        "csatornatakarítás",
                        "kotrógép",
                        "kotrási munkák"
                    ]
                }
            }

    def initialize_driver(self):
        """Chrome driver inicializálása fejlesztői eszközökkel."""
        print("🚀 Chrome driver inicializálása...")
        options = webdriver.ChromeOptions()
        options.add_argument('--start-maximized')
        options.add_argument('--disable-blink-features=AutomationControlled')
        self.driver = webdriver.Chrome(options=options)
        print("✅ Driver inicializálva\n")

    def login(self) -> bool:
        """
        Belépés az EKR rendszerbe.
        SMS kódot kér a felhasználótól.

        Returns:
            bool: True ha sikeres a belépés
        """
        if not self.username or not self.password:
            print("❌ Hiányzó credentials! Állítsd be az EKR_USERNAME és EKR_PASSWORD környezeti változókat,")
            print("   vagy add meg őket paraméterként!")
            return False

        print(f"🔐 Belépés az EKR-be: {self.username}")
        self.driver.get(f"{self.base_url}/portal/kezdolap")
        time.sleep(2)

        try:
            # Belépés gomb
            login_btn = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.LINK_TEXT, "BELÉPÉS"))
            )
            login_btn.click()
            time.sleep(2)

            # Email és jelszó megadása
            email_input = self.driver.find_element(By.NAME, "username")
            email_input.send_keys(self.username)

            password_input = self.driver.find_element(By.NAME, "password")
            password_input.send_keys(self.password)

            submit_btn = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            submit_btn.click()

            # SMS kód bekérése
            print("📱 SMS kód bekérése...")
            sms_code = input("   ➤ Kérlek add meg az SMS kódot: ")

            sms_input = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.NAME, "sms_code"))
            )
            sms_input.send_keys(sms_code)
            sms_input.send_keys(Keys.RETURN)

            time.sleep(3)
            print("✅ Sikeres belépés!\n")
            return True

        except Exception as e:
            print(f"❌ Belépési hiba: {e}\n")
            return False

    def activate_active_procedures_filter(self):
        """
        'Aktuális üzleti lehetőség' szűrő aktiválása.
        Csak a le nem járt határidejű tendereket mutatja.
        """
        if not self.only_active:
            print("ℹ️  'Csak aktív tenderek' szűrő kikapcsolva - minden tender látható\n")
            return True

        print("🔧 'Aktuális üzleti lehetőség' szűrő aktiválása...")
        try:
            active_checkbox = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//label[contains(text(), 'Aktuális üzleti lehetőség')]"))
            )

            checkbox_input = active_checkbox.find_element(By.XPATH, ".//input[@type='checkbox']")
            if not checkbox_input.is_selected():
                active_checkbox.click()
                time.sleep(1)
                print("✅ 'Aktuális üzleti lehetőség' szűrő aktiválva\n")
            else:
                print("✅ 'Aktuális üzleti lehetőség' szűrő már aktív\n")

            return True
        except Exception as e:
            print(f"⚠️  Szűrő aktiválási hiba: {e}")
            print("⚠️  Folytatás az alapértelmezett szűrővel...\n")
            return False

    def search_keyword(self, keyword: str, priority: str, category: str) -> Dict:
        """
        Egy kulcsszó alapján keresés végrehajtása.

        Args:
            keyword: Keresendő kulcsszó
            priority: Prioritási szint (magas_prioritas/kozepes_prioritas)
            category: Kategória név

        Returns:
            Dict: Keresési eredmény adatok
        """
        print(f"🔍 Keresés: '{keyword}' (Prioritás: {priority})")

        try:
            # Keresőmező
            search_box = self.driver.find_element(
                By.CSS_SELECTOR,
                "input[placeholder='Keresés az EKR eljárásaiban...']"
            )

            # Kulcsszó beírása
            search_box.clear()
            search_box.send_keys(keyword)
            time.sleep(0.5)

            # Keresés gomb
            search_btn = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            search_btn.click()
            time.sleep(2)

            # Találatok száma
            results_elem = self.driver.find_element(By.CSS_SELECTOR, ".eljaras-list-count")
            results_text = results_elem.text
            results_count = int(''.join(filter(str.isdigit, results_text)))

            current_url = self.driver.current_url

            result = {
                "search_id": len(self.search_log["search_results"]) + 1,
                "keyword": keyword,
                "priority": priority,
                "category": category,
                "results_count": results_count,
                "url": current_url,
                "timestamp": datetime.now().isoformat(),
                "status": "completed"
            }

            self.search_log["search_results"].append(result)
            print(f"   ✅ Találatok: {results_count} db")
            print(f"   🔗 URL: {current_url}\n")

            return result

        except Exception as e:
            print(f"   ❌ Keresési hiba: {e}\n")
            return {
                "keyword": keyword,
                "priority": priority,
                "category": category,
                "status": "failed",
                "error": str(e)
            }

    def execute_search_strategy(self, priority_level: Optional[str] = None):
        """
        Keresési stratégia végrehajtása.

        Args:
            priority_level: Prioritási szint (None = minden szint)
        """
        if priority_level:
            levels = [priority_level]
        else:
            levels = list(self.search_strategy.keys())

        for level in levels:
            strategy = self.search_strategy.get(level)
            if not strategy:
                print(f"❌ Ismeretlen prioritási szint: {level}\n")
                continue

            keywords = strategy["kulcsszavak"]
            category = strategy["kategoria"]

            print(f"{'='*70}")
            print(f"🎯 Keresési kategória: {category}")
            print(f"   Kulcsszavak száma: {len(keywords)}")
            print(f"{'='*70}\n")

            for idx, keyword in enumerate(keywords, 1):
                print(f"[{idx}/{len(keywords)}] ", end="")
                self.search_keyword(keyword, level, category)
                time.sleep(1)  # Rate limiting

    def calculate_performance_metrics(self):
        """Teljesítmény metrikák számítása és mentése."""
        total_planned = sum(
            len(strategy["kulcsszavak"])
            for strategy in self.search_strategy.values()
        )
        completed = len([r for r in self.search_log["search_results"] if r.get("status") == "completed"])
        failed = len([r for r in self.search_log["search_results"] if r.get("status") == "failed"])
        total_results = sum(
            r.get("results_count", 0)
            for r in self.search_log["search_results"]
        )

        coverage = (completed / total_planned * 100) if total_planned > 0 else 0

        self.search_log["performance_metrics"] = {
            "total_searches_planned": total_planned,
            "searches_completed": completed,
            "searches_failed": failed,
            "total_results_found": total_results,
            "coverage_percentage": round(coverage, 2),
            "status": "completed" if coverage == 100 and failed == 0 else "completed_with_issues"
        }

    def generate_reports(self):
        """JSON és Markdown riportok generálása a results mappába."""
        print("\n" + "="*70)
        print("📝 Riportok generálása...")
        print("="*70 + "\n")

        # Results mappa létrehozása
        results_dir = "results"
        os.makedirs(results_dir, exist_ok=True)

        # Session befejezése
        self.search_log["search_session"]["end_time"] = datetime.now().isoformat()
        self.search_log["search_session"]["status"] = "completed"

        # JSON riport
        json_filename = os.path.join(results_dir, f"ekr_search_{self.session_id}.json")
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(self.search_log, f, ensure_ascii=False, indent=2)
        print(f"✅ JSON riport: {json_filename}")

        # Markdown riport
        md_filename = os.path.join(results_dir, f"ekr_report_{self.session_id}.md")
        md_content = self._generate_markdown_report()
        with open(md_filename, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"✅ Markdown riport: {md_filename}")

    def _generate_markdown_report(self) -> str:
        """Markdown riport tartalom generálása."""
        metrics = self.search_log["performance_metrics"]
        results = self.search_log["search_results"]

        # Kategóriák szerinti csoportosítás
        by_category = {}
        for r in results:
            cat = r.get("category", "Egyéb")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(r)

        md = f"""# 🔍 EKR Keresési Riport - Iszapfaló Kft.

**Session ID**: `{self.session_id}`
**Dátum**: {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Státusz**: ✅ BEFEJEZVE
**Szűrő**: {'🟢 Csak aktív tenderek' if self.only_active else '🔵 Minden tender'}

---

## 📊 Összesítés

| Metrika | Érték |
|---------|-------|
| Tervezett keresések | {metrics['total_searches_planned']} db |
| Végrehajtott keresések | {metrics['searches_completed']} db |
| Sikertelen keresések | {metrics['searches_failed']} db |
| **Összes találat** | **{metrics['total_results_found']} tender** |
| Lefedettség | {metrics['coverage_percentage']}% |

---

## 🎯 Részletes Eredmények Kategóriánként

"""
        for category, cat_results in by_category.items():
            total_cat_results = sum(r.get("results_count", 0) for r in cat_results)
            md += f"\n### {category}\n\n"
            md += f"**Összes találat ebben a kategóriában**: {total_cat_results} tender\n\n"
            md += "| # | Kulcsszó | Találatok | URL |\n"
            md += "|---|----------|-----------|-----|\n"

            for r in cat_results:
                if r.get("status") == "completed":
                    md += f"| {r['search_id']} | {r['keyword']} | {r.get('results_count', 'N/A')} | [Link]({r.get('url', '#')}) |\n"
                else:
                    md += f"| {r['search_id']} | {r['keyword']} | ❌ Hiba | - |\n"

        md += f"""
---

## 📈 Top 5 Kulcsszó (Legtöbb találat)

"""
        # Top 5 kulcsszó
        sorted_results = sorted(
            [r for r in results if r.get("status") == "completed"],
            key=lambda x: x.get("results_count", 0),
            reverse=True
        )[:5]

        for idx, r in enumerate(sorted_results, 1):
            md += f"{idx}. **{r['keyword']}**: {r.get('results_count', 0)} tender\n"

        md += f"""
---

**🤖 Generálva**: EKR Agent - Iszapfaló Kft. Tender Monitoring System
**⏱️ Időbélyeg**: {datetime.now().isoformat()}
"""
        return md

    def print_summary(self):
        """Összefoglaló kiírása a konzolra."""
        metrics = self.search_log["performance_metrics"]

        print("\n" + "="*70)
        print("📊 ÖSSZEFOGLALÓ")
        print("="*70)
        print(f"✅ Végrehajtott keresések: {metrics['searches_completed']}/{metrics['total_searches_planned']}")

        if metrics['searches_failed'] > 0:
            print(f"⚠️  Sikertelen keresések: {metrics['searches_failed']}")

        print(f"📋 Összes találat: {metrics['total_results_found']} tender")
        print(f"📈 Lefedettség: {metrics['coverage_percentage']}%")
        print(f"🎯 Státusz: {metrics['status']}")
        print("="*70 + "\n")

    def run(self):
        """Teljes ügynök futtatása - fő entry point."""
        print("\n" + "="*70)
        print("🤖 EKR AGENT - ISZAPFALÓ KFT.")
        print("="*70)
        print(f"📅 Session: {self.session_id}")
        print(f"🎯 Mód: {'Csak aktív tenderek' if self.only_active else 'Minden tender'}")
        print("="*70 + "\n")

        try:
            self.initialize_driver()

            if not self.login():
                print("❌ Belépési hiba, futtatás megszakítva.\n")
                return False

            self.activate_active_procedures_filter()

            # Stratégia végrehajtása
            self.execute_search_strategy()

            # Metrikák és riportok
            self.calculate_performance_metrics()
            self.print_summary()
            self.generate_reports()

            print("🎉 Ügynök futtatása sikeresen befejeződött!\n")
            return True

        except Exception as e:
            print(f"\n❌ Kritikus hiba: {e}\n")
            return False
        finally:
            if self.driver:
                input("Nyomj ENTER-t a böngésző bezárásához...")
                self.driver.quit()


# ============================================================================
# CLI HASZNÁLAT
# ============================================================================

def main():
    """Parancssori interfész az ügynök futtatásához."""
    import argparse

    parser = argparse.ArgumentParser(
        description="EKR Agent - Elektronikus Közbeszerzési Rendszer monitoring",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Példák:
  python agents/ekr_agent.py
  python agents/ekr_agent.py --username email@example.com --password mypass
  python agents/ekr_agent.py --all
  python agents/ekr_agent.py --keyword "iszapkotrás" --keyword "vízépítés"
        """
    )

    parser.add_argument(
        "--username",
        help="EKR felhasználónév (email) - vagy EKR_USERNAME env változó"
    )
    parser.add_argument(
        "--password",
        help="EKR jelszó - vagy EKR_PASSWORD env változó"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Minden tender keresése (aktív + lezárt is)"
    )
    parser.add_argument(
        "--keyword",
        action="append",
        help="Egyedi kulcsszó hozzáadása (többször is használható)"
    )

    args = parser.parse_args()

    # Agent inicializálása
    agent = EKRAgent(
        username=args.username,
        password=args.password,
        only_active=not args.all,
        custom_keywords=args.keyword
    )

    # Futtatás
    success = agent.run()
    exit(0 if success else 1)


if __name__ == "__main__":
    main()
