#!/bin/bash

REPO="pohi99999/mcp-brunella-core"

echo "🚀 Brunella-Core Projekt Rendszerező indítása..."

# 1. Alapvető Label-ek (Címkék) létrehozása a rendszerezéshez
echo "🏷️ Címkék beállítása..."
gh label create "mcp-tool" --color "0075ca" --description "Új MCP eszköz fejlesztése" --repo $REPO --force
gh label create "core-logic" --color "d73a4a" --description "A rendszer magját érintő fejlesztés" --repo $REPO --force
gh label create "database" --color "a2eeef" --description "Adatbázis és tárolás" --repo $REPO --force

# 2. Mérföldkövek (Milestones) létrehozása a Copilot-tal egyeztetve
echo "🏁 Mérföldkövek létrehozása..."
gh api repos/$REPO/milestones -f title="Fázis 3: Stabilizálás" -f state="open" -f description="Hibajavítás és tesztelés"
gh api repos/$REPO/milestones -f title="Fázis 4: Adat-Raj (Data Swarm)" -f state="open" -f description="Tömeges ágens kezelés"

# 3. Az aktuális feladatok (Issue-k) generálása
echo "📝 Alapvető feladatok felvétele..."

# Feladat 1: Dashboard helyreállítás
gh issue create --title "Dashboard integráció véglegesítése" \
                --body "A korábbi hálózati hiba utáni teljes szinkronizáció a frontend és az MCP server között." \
                --label "core-logic" \
                --milestone "Fázis 3: Stabilizálás"

# Feladat 2: Adatbázis struktúra
gh issue create --title "SQLite/LanceDB séma véglegesítése" \
                --body "Az Adat-Raj fázishoz szükséges adatbázis táblák létrehozása." \
                --label "database" \
                --milestone "Fázis 4: Adat-Raj (Data Swarm)"

echo "✅ Kész! A GitHub-on a 'Issues' menüpont alatt már látod a rendszert."
