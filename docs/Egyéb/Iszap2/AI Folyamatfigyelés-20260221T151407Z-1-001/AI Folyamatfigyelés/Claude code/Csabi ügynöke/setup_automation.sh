#!/bin/bash
# -*- coding: utf-8 -*-
#
# Alpha Agent Automatikus Rendszer - Telepítő Szkript
# Ez a szkript beállítja a teljes automatikus működést
#

set -e

echo "🚀 Alpha Agent Automatizálási Telepítő"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Munkakönyvtár
WORK_DIR="/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"
cd "$WORK_DIR"

# 1. Python környezet ellenőrzése
echo "1️⃣ Python környezet ellenőrzése..."
if command -v python3 &> /dev/null; then
    echo "   ✅ Python3 megtalálva: $(python3 --version)"
else
    echo "   ❌ Python3 nem található!"
    exit 1
fi

# 2. Python csomagok telepítése
echo ""
echo "2️⃣ Python csomagok telepítése..."
pip3 install --quiet reportlab pillow 2>&1 | grep -v "already satisfied" || true
echo "   ✅ reportlab és pillow telepítve"

# 3. Gmail App Password beállítása
echo ""
echo "3️⃣ Gmail App Password beállítása..."
GMAIL_PASSWORD_FILE="$WORK_DIR/.gmail_app_password"

if [ ! -f "$GMAIL_PASSWORD_FILE" ]; then
    echo ""
    echo "   ⚠️  Gmail App Password szükséges az email küldéshez!"
    echo ""
    echo "   Kövesse ezeket a lépéseket:"
    echo "   1. Menjen a Google Account beállításokhoz"
    echo "   2. Biztonság → 2-lépéses hitelesítés"
    echo "   3. App jelszavak → Új app jelszó létrehozása"
    echo "   4. Válasszon 'Mail' és 'Mac' opciókat"
    echo "   5. Másolja ki a 16 karakteres jelszót"
    echo ""
    echo -n "   Adja meg a Gmail App Password-öt (16 karakter): "
    read -s GMAIL_PASS
    echo ""
    echo "$GMAIL_PASS" > "$GMAIL_PASSWORD_FILE"
    chmod 600 "$GMAIL_PASSWORD_FILE"
    echo "   ✅ Gmail App Password elmentve: $GMAIL_PASSWORD_FILE"
else
    echo "   ✅ Gmail App Password már be van állítva"
fi

# 4. Végrehajtási jogok beállítása
echo ""
echo "4️⃣ Végrehajtási jogok beállítása..."
chmod +x "$WORK_DIR/alpha_agent.py"
chmod +x "$WORK_DIR/generate_pdf.py"
echo "   ✅ Szkriptek végrehajthatók"

# 5. Cron job beállítása
echo ""
echo "5️⃣ Cron job beállítása (minden nap 6:00-kor)..."

# Crontab bejegyzés
CRON_JOB="0 6 * * * cd \"$WORK_DIR\" && /usr/bin/python3 \"$WORK_DIR/alpha_agent.py\" >> \"$WORK_DIR/alpha_agent.log\" 2>&1"

# Meglévő crontab mentése
crontab -l > /tmp/current_cron 2>/dev/null || touch /tmp/current_cron

# Ellenőrizzük, hogy már létezik-e
if grep -q "alpha_agent.py" /tmp/current_cron; then
    echo "   ✅ Cron job már létezik"
else
    # Új cron job hozzáadása
    echo "$CRON_JOB" >> /tmp/current_cron
    crontab /tmp/current_cron
    echo "   ✅ Cron job hozzáadva"
fi

rm /tmp/current_cron

# 6. Teszt futtatás
echo ""
echo "6️⃣ Teszt futtatás..."
echo "   (Ez eltarthat néhány másodpercig...)"
echo ""

python3 "$WORK_DIR/alpha_agent.py" 2>&1 | head -20

# 7. Összefoglaló
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TELEPÍTÉS SIKERES!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Beállítások:"
echo "   • Munkakönyvtár: $WORK_DIR"
echo "   • Futási idő: Minden nap 6:00-kor"
echo "   • Email cím: kovasznai.gergely@gmail.com"
echo "   • Log fájl: $WORK_DIR/alpha_agent.log"
echo ""
echo "🎯 Következő lépések:"
echo "   1. A rendszer MINDEN NAP automatikusan fut 6:00-kor"
echo "   2. Email-t küld a napi jelentéssel"
echo "   3. Fájlokat ment (TXT, MD, PDF) a Google Drive-ra"
echo ""
echo "🔧 Manuális futtatás:"
echo "   python3 $WORK_DIR/alpha_agent.py"
echo ""
echo "📊 Log megtekintése:"
echo "   tail -f $WORK_DIR/alpha_agent.log"
echo ""
echo "⏰ Cron job ellenőrzése:"
echo "   crontab -l"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
