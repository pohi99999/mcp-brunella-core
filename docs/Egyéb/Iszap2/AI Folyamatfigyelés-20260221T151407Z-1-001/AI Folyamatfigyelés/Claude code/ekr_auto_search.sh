#!/bin/bash
# EKR Automatikus Keresés - Egyszerű Launcher
# Használat: ./ekr_auto_search.sh

echo "🚀 EKR Automatikus Keresés Indítása..."
echo ""
echo "📋 Keresendő kulcsszavak:"
echo "  1. iszapkotrás"
echo "  2. mederkotrás"
echo "  3. tókotrás"
echo "  4. kotrás"
echo "  5. csapadékvíz"
echo "  6. vízrendezés"
echo "  7. vízépítés"
echo "  8. iszapkezelés"
echo "  9. víztelenített iszap"
echo ""
echo "✅ Előfeltételek:"
echo "  - Be vagy lépve az EKR-be a böngészőben"
echo "  - Chrome MCP connector aktív"
echo ""

read -p "Folytatod? (igen/nem): " confirm

if [ "$confirm" != "igen" ]; then
    echo "❌ Megszakítva"
    exit 0
fi

echo ""
echo "🔄 Keresés indítása..."
echo "⏳ Ez ~5 percet vesz igénybe..."
echo ""

# Itt folytatódik Claude Code-dal
echo "✅ Script kész - Claude folytatja a böngészőben!"
