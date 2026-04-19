#!/usr/bin/env python3
"""
Iszapfaló n8n javítás — Playwright (real Chrome) + REST API
Feladatok:
  1. n8n bejelentkezés (iszapfalo@gmail.com / Iszapfalo13)
  2. API kulcs lekérése / generálása
  3. Credential ID-k lekérése
  4. 06-os workflow Airtable Partnerek node javítása (baseId + tableId)
  5. Credential csere 4 workflow-ban (ISZ_Airtable_PAT_v3-ra)
  6. 01-es workflow webhook path ellenőrzése
"""
import asyncio
import json
import requests
import os
import sys
from playwright.async_api import async_playwright

N8N_BASE = "https://iszapfalo.app.n8n.cloud"
EMAIL = "iszapfalo@gmail.com"
PASSWORD = "Iszapfalo13"
SCREENSHOT_DIR = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
AIRTABLE_BASE_ID = "appU3xQMuAmpmmCEy"
AIRTABLE_PARTNEREK_TABLE_ID = "tblCR2aIaM4aNmsSm"

# Workflow ID-k
WF_06 = "LGvkbQNUm44UEoMi"
WF_04 = "hLop0AeEKH6NyUaj"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = {
    "login": False,
    "api_key": None,
    "credentials": [],
    "workflows_fixed": [],
    "errors": []
}

# ─────────────────────────────────────────────
# RÉSZ 1: Playwright — bejelentkezés + API kulcs
# ─────────────────────────────────────────────
async def get_api_key_via_browser():
    async with async_playwright() as p:
        print("[1] Chrome indítása (valódi, nem headless)...")
        browser = await p.chromium.launch(
            headless=False,
            channel="chrome",
            slow_mo=400,
            args=["--no-sandbox", "--start-maximized"]
        )
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
        )
        page = await context.new_page()

        # ── BEJELENTKEZÉS ──
        print(f"[2] Megnyitom: {N8N_BASE}/signin")
        await page.goto(f"{N8N_BASE}/signin", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}\\n8n_01_signin.png")

        # Email mező kitöltése
        try:
            await page.wait_for_selector('input', timeout=8000)
            # Próbálj különféle selectorokat
            for sel in ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="mail"]', 'input:first-of-type']:
                try:
                    el = page.locator(sel).first
                    if await el.is_visible():
                        await el.click()
                        await el.fill("")
                        await el.type(EMAIL, delay=50)
                        print(f"  Email kitöltve ({sel})")
                        break
                except:
                    continue
        except Exception as e:
            print(f"  Email hiba: {e}")
            results["errors"].append(f"Email fill: {e}")

        await page.wait_for_timeout(500)

        # Jelszó kitöltése
        try:
            for sel in ['input[type="password"]', 'input[name="password"]']:
                try:
                    el = page.locator(sel).first
                    if await el.is_visible():
                        await el.click()
                        await el.fill("")
                        await el.type(PASSWORD, delay=50)
                        print(f"  Jelszó kitöltve ({sel})")
                        break
                except:
                    continue
        except Exception as e:
            print(f"  Jelszó hiba: {e}")
            results["errors"].append(f"Password fill: {e}")

        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{SCREENSHOT_DIR}\\n8n_02_filled.png")

        # Submit
        try:
            for sel in ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Log in")']:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible():
                        await btn.click()
                        print(f"  Submit kattintva ({sel})")
                        break
                except:
                    continue
        except Exception as e:
            print(f"  Submit hiba: {e}")

        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(3000)
        current_url = page.url
        print(f"[3] URL bejelentkezés után: {current_url}")
        await page.screenshot(path=f"{SCREENSHOT_DIR}\\n8n_03_after_login.png")

        if "signin" in current_url:
            # Oldjuk ki a szöveget hogy lássuk a hibát
            body = await page.inner_text("body")
            print(f"  Bejelentkezés SIKERTELEN! Oldal szöveg: {body[:300]}")
            results["login"] = False
            await browser.close()
            return None

        results["login"] = True
        print("  ✅ Bejelentkezés SIKERES!")

        # ── API KULCS ──
        print("[4] API beállítások megnyitása...")
        await page.goto(f"{N8N_BASE}/settings/api", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}\\n8n_04_api_settings.png")

        page_text = await page.inner_text("body")
        print(f"  API oldal szöveg: {page_text[:400]}")

        api_key = None

        # Keressük az API kulcs inputot
        all_inputs = await page.locator('input').all()
        for inp in all_inputs:
            try:
                val = await inp.input_value()
                if val and len(val) > 30 and ("eyJ" in val or "n8n_api" in val or "_" in val):
                    api_key = val
                    print(f"  ✅ API kulcs megtalálva: {api_key[:30]}...")
                    break
            except:
                continue

        if not api_key:
            # Próbáljuk generálni
            print("  API kulcs nem látható, próbálom generálni...")
            for btn_text in ["Create an API key", "Create", "Generate", "New API key"]:
                try:
                    btn = page.locator(f'button:has-text("{btn_text}")').first
                    if await btn.is_visible():
                        await btn.click()
                        await page.wait_for_timeout(2000)
                        print(f"  Gomb megnyomva: {btn_text}")
                        break
                except:
                    continue

            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}\\n8n_05_api_after_create.png")

            # Újra keressük az inputot
            all_inputs = await page.locator('input').all()
            for inp in all_inputs:
                try:
                    val = await inp.input_value()
                    if val and len(val) > 20:
                        api_key = val
                        print(f"  ✅ Új API kulcs: {api_key[:30]}...")
                        break
                except:
                    continue

        # Ha még mindig nincs API kulcs: próbáljuk a Copy gombbal
        if not api_key:
            print("  Próbálom a Copy/Reveal gombot...")
            try:
                # Kattints a masked key-re vagy a Copy gombra
                for sel in ['button:has-text("Copy")', 'button[aria-label*="copy"]', 'button[aria-label*="Copy"]']:
                    try:
                        btn = page.locator(sel).first
                        if await btn.is_visible():
                            await btn.click()
                            await page.wait_for_timeout(500)
                            # Clipboard tartalom
                            api_key = await page.evaluate("navigator.clipboard.readText()")
                            if api_key and len(api_key) > 20:
                                print(f"  ✅ Copy gombbal megkapva: {api_key[:30]}...")
                            break
                    except:
                        continue
            except Exception as e:
                print(f"  Copy próba hiba: {e}")

        # Session cookie mentése (fallback)
        cookies = await context.cookies()
        n8n_auth_cookie = None
        for c in cookies:
            if c['name'] == 'n8n-auth':
                n8n_auth_cookie = c['value']
                print(f"  ✅ n8n-auth cookie megvan (hossz: {len(n8n_auth_cookie)})")
                break

        await page.screenshot(path=f"{SCREENSHOT_DIR}\\n8n_06_final.png")
        await browser.close()

        if api_key:
            results["api_key"] = api_key
            print(f"\n✅ API kulcs megvan!")

        # API kulcs nélkül is vissza adjuk a cookie-t
        return {"api_key": api_key, "session_cookie": n8n_auth_cookie}

# ─────────────────────────────────────────────
# RÉSZ 2: REST API munkák
# ─────────────────────────────────────────────
def do_rest_work(api_key=None, session_cookie=None):
    # n8n API: X-N8N-API-KEY header VAGY session cookie
    if api_key:
        headers = {
            "X-N8N-API-KEY": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        base = f"{N8N_BASE}/api/v1"
        print(f"  Auth: API kulcs")
    elif session_cookie:
        headers = {
            "Cookie": f"n8n-auth={session_cookie}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        base = f"{N8N_BASE}/rest"
        print(f"  Auth: session cookie")
    else:
        print("❌ Nincs auth adat!")
        return

    # ── Credentials lekérés ──
    print("\n[A] Credentials lekérése...")
    # Próbáljuk mindkét endpointot
    for cred_url in [f"{base}/credentials", f"{N8N_BASE}/rest/credentials"]:
        r = requests.get(cred_url, headers=headers, params={"limit": 50})
        print(f"  GET {cred_url} → {r.status_code}")
        if r.ok:
            creds_raw = r.json()
            # API v1 → {"data": [...]}  |  REST → [...] vagy {"data": [...]}
            if isinstance(creds_raw, list):
                creds = creds_raw
            else:
                creds = creds_raw.get("data", creds_raw.get("credentials", []))
            break
    else:
        print("  ❌ Credentials lekérése sikertelen!")
        return

    cred_map = {}
    for c in creds:
        print(f"    [{c['id']}] {c['name']} ({c['type']})")
        cred_map[c['name']] = c['id']
        results["credentials"].append({"id": c['id'], "name": c['name'], "type": c['type']})

    # Keressük az ISZ_Airtable_PAT_v3 ID-t
    pat_v3_id = cred_map.get("ISZ_Airtable_PAT_v3")
    if pat_v3_id:
        print(f"\n  ✅ ISZ_Airtable_PAT_v3 ID: {pat_v3_id}")
    else:
        print("\n  ❌ ISZ_Airtable_PAT_v3 NEM TALÁLHATÓ!")
        return

    # ── Workflow 06 javítása ──
    print(f"\n[B] Workflow 06 lekérése ({WF_06})...")
    r = requests.get(f"{base}/workflows/{WF_06}", headers=headers)
    print(f"  Status: {r.status_code}")
    if not r.ok:
        print(f"  HIBA: {r.text[:300]}")
        return

    wf06 = r.json()
    print(f"  Workflow neve: {wf06.get('name')}")
    nodes = wf06.get("nodes", [])
    print(f"  Node-ok száma: {len(nodes)}")

    changed = False
    for node in nodes:
        node_name = node.get("name", "")
        node_type = node.get("type", "")

        # Airtable node-ok
        if "airtable" in node_type.lower():
            print(f"\n    Node: {node_name} ({node_type})")
            params = node.get("parameters", {})
            cred = node.get("credentials", {})

            # Credential csere
            old_creds = list(cred.keys())
            print(f"    Credential kulcsok: {old_creds}")

            # Partnerek/CRM node javítása
            base_id_val = params.get("base", {}).get("value", "") if isinstance(params.get("base"), dict) else params.get("base", "")
            table_id_val = params.get("table", {}).get("value", "") if isinstance(params.get("table"), dict) else params.get("table", "")
            print(f"    base: {base_id_val} | table: {table_id_val}")

            if not base_id_val or base_id_val != AIRTABLE_BASE_ID:
                print(f"    → base javítása: {base_id_val} → {AIRTABLE_BASE_ID}")
                if isinstance(params.get("base"), dict):
                    node["parameters"]["base"]["value"] = AIRTABLE_BASE_ID
                else:
                    node["parameters"]["base"] = AIRTABLE_BASE_ID
                changed = True

            if ("Create_a_record" in node_name or "Airtable" in node_name) and (not table_id_val or table_id_val != AIRTABLE_PARTNEREK_TABLE_ID):
                if "partner" in node_name.lower() or "crm" in node_name.lower() or "create" in node_name.lower():
                    print(f"    → table javítása: {table_id_val} → {AIRTABLE_PARTNEREK_TABLE_ID}")
                    if isinstance(params.get("table"), dict):
                        node["parameters"]["table"]["value"] = AIRTABLE_PARTNEREK_TABLE_ID
                    else:
                        node["parameters"]["table"] = AIRTABLE_PARTNEREK_TABLE_ID
                    changed = True

            # Credential csere ISZ_Airtable_PAT_v3-ra
            for cred_type in list(cred.keys()):
                if cred_type in ("airtableApi", "airtableTokenApi"):
                    print(f"    → credential csere: {cred[cred_type]} → ISZ_Airtable_PAT_v3 ({pat_v3_id})")
                    node["credentials"]["airtableTokenApi"] = {
                        "id": pat_v3_id,
                        "name": "ISZ_Airtable_PAT_v3"
                    }
                    if cred_type != "airtableTokenApi":
                        del node["credentials"][cred_type]
                    changed = True

    if changed:
        print(f"\n  💾 Workflow 06 mentése...")
        save_data = {
            "name": wf06["name"],
            "nodes": wf06["nodes"],
            "connections": wf06["connections"],
            "settings": wf06.get("settings", {})
        }
        r = requests.put(f"{base}/workflows/{WF_06}", headers=headers, json=save_data)
        print(f"  Mentés status: {r.status_code}")
        if r.ok:
            print("  ✅ Workflow 06 sikeresen javítva és mentve!")
            results["workflows_fixed"].append("06 - ISZ Gmail Categorizel")
        else:
            print(f"  ❌ Mentés HIBA: {r.text[:300]}")
    else:
        print("\n  ℹ️ Workflow 06 nem igényel javítást (már helyes)")

    # ── Workflow 04 credential csere ──
    print(f"\n[C] Workflow 04 credential csere ({WF_04})...")
    r = requests.get(f"{base}/workflows/{WF_04}", headers=headers)
    if r.ok:
        wf04 = r.json()
        nodes = wf04.get("nodes", [])
        changed04 = False
        for node in nodes:
            if "airtable" in node.get("type", "").lower():
                cred = node.get("credentials", {})
                for cred_type in list(cred.keys()):
                    if cred_type == "airtableApi":
                        print(f"  → {node['name']}: credential csere ISZ_Airtable_PAT_v3-ra")
                        node["credentials"]["airtableTokenApi"] = {"id": pat_v3_id, "name": "ISZ_Airtable_PAT_v3"}
                        del node["credentials"]["airtableApi"]
                        changed04 = True

        if changed04:
            save_data = {"name": wf04["name"], "nodes": wf04["nodes"], "connections": wf04["connections"], "settings": wf04.get("settings", {})}
            r = requests.put(f"{base}/workflows/{WF_04}", headers=headers, json=save_data)
            print(f"  Mentés status: {r.status_code}")
            if r.ok:
                print("  ✅ Workflow 04 javítva!")
                results["workflows_fixed"].append("04 - ISZ Weekly Reminder")
            else:
                print(f"  ❌ Mentés HIBA: {r.text[:300]}")
        else:
            print("  ℹ️ Workflow 04 nem igényel credential cserét")

    # ── Az összes workflow ellenőrzése (Airtable credential) ──
    print("\n[D] Összes workflow ellenőrzése (Airtable credential csere)...")
    r = requests.get(f"{base}/workflows", headers=headers, params={"limit": 20})
    if r.ok:
        all_wfs = r.json().get("data", [])
        for wf in all_wfs:
            if wf["id"] in (WF_06, WF_04):
                continue  # Már feldolgoztuk
            wf_detail = requests.get(f"{base}/workflows/{wf['id']}", headers=headers).json()
            nodes = wf_detail.get("nodes", [])
            changed_wf = False
            for node in nodes:
                if "airtable" in node.get("type", "").lower():
                    cred = node.get("credentials", {})
                    if "airtableApi" in cred:
                        print(f"  → {wf['name']} / {node['name']}: credential csere")
                        node["credentials"]["airtableTokenApi"] = {"id": pat_v3_id, "name": "ISZ_Airtable_PAT_v3"}
                        del node["credentials"]["airtableApi"]
                        changed_wf = True

            if changed_wf:
                save_data = {"name": wf_detail["name"], "nodes": wf_detail["nodes"], "connections": wf_detail["connections"], "settings": wf_detail.get("settings", {})}
                r2 = requests.put(f"{base}/workflows/{wf['id']}", headers=headers, json=save_data)
                if r2.ok:
                    print(f"  ✅ {wf['name']} javítva!")
                    results["workflows_fixed"].append(wf['name'])
                else:
                    print(f"  ❌ {wf['name']} mentés HIBA: {r2.text[:200]}")

    # ── Végeredmény ──
    print("\n" + "="*60)
    print("VÉGEREDMÉNY:")
    print("="*60)
    print(json.dumps(results, indent=2, ensure_ascii=False))

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
async def main():
    print("🚀 Iszapfaló n8n javítás indítása...")
    print(f"  Cél: {N8N_BASE}")
    print(f"  Email: {EMAIL}\n")

    auth = await get_api_key_via_browser()

    if auth:
        api_key = auth.get("api_key")
        session_cookie = auth.get("session_cookie")
        print(f"\n  API kulcs: {'✅ megvan' if api_key else '❌ nincs'}")
        print(f"  Session cookie: {'✅ megvan' if session_cookie else '❌ nincs'}")
        do_rest_work(api_key=api_key, session_cookie=session_cookie)
    else:
        print("\n❌ Auth adatok nélkül REST munkák nem végezhetők!")
        print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
