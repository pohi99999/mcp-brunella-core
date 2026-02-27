#!/bin/bash
# Egyszerű one-click telepítő - Gmail jelszó nélkül

set -e

WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$WORK_DIR"

echo "🚀 Alpha Agent Automatikus Telepítő"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Python ellenőrzése
echo "1️⃣ Python ellenőrzése..."
if ! command -v python3 &> /dev/null; then
    echo "   ❌ Python3 nem található!"
    exit 1
fi
echo "   ✅ Python3: $(python3 --version)"

# 2. Csomagok telepítése
echo ""
echo "2️⃣ Python csomagok telepítése..."
pip3 install -q reportlab pillow 2>/dev/null || pip3 install reportlab pillow
echo "   ✅ Csomagok telepítve"

# 3. Végrehajtási jogok
echo ""
echo "3️⃣ Végrehajtási jogok..."
chmod +x "$WORK_DIR/alpha_agent.py"
chmod +x "$WORK_DIR/generate_pdf.py"
echo "   ✅ Szkriptek futtathatók"

# 4. Cron job
echo ""
echo "4️⃣ Cron job beállítása (6:00-kor minden nap)..."
CRON_JOB="0 6 * * * cd \"$WORK_DIR\" && /usr/bin/python3 \"$WORK_DIR/alpha_agent.py\" >> \"$WORK_DIR/alpha_agent.log\" 2>&1"
crontab -l > /tmp/current_cron 2>/dev/null || touch /tmp/current_cron

if grep -q "alpha_agent.py" /tmp/current_cron; then
    echo "   ✅ Cron job már létezik"
else
    echo "$CRON_JOB" >> /tmp/current_cron
    crontab /tmp/current_cron
    echo "   ✅ Cron job létrehozva"
fi
rm /tmp/current_cron

# 5. Gmail Password ellenőrzése
echo ""
echo "5️⃣ Gmail App Password ellenőrzése..."
if [ ! -f "$WORK_DIR/.gmail_app_password" ]; then
    echo "   ⚠️  Gmail App Password még nincs beállítva!"
    echo ""
    echo "   📋 KÖVETKEZŐ LÉPÉS:"
    echo "   1. Szerezz Gmail App Password-öt:"
    echo "      https://myaccount.google.com/apppasswords"
    echo "   2. Mentsd el:"
    echo "      echo 'YOUR_16_CHAR_PASSWORD' > .gmail_app_password"
    echo "      chmod 600 .gmail_app_password"
    echo ""
else
    echo "   ✅ Gmail App Password beállítva"
fi

# 6. Teszt
echo ""
echo "6️⃣ Gyors teszt..."
python3 -c "import sys; print('   ✅ Python működik')"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TELEPÍTÉS SIKERES!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏰ Automatikus futás: Minden nap 6:00-kor"
echo "📧 Email: kovasznai.gergely@gmail.com"
echo "📁 Munkamappa: $WORK_DIR"
echo ""
echo "🔧 Manuális futtatás:"
echo "   python3 $WORK_DIR/alpha_agent.py"
echo ""
echo "📊 Cron job ellenőrzése:"
echo "   crontab -l"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
