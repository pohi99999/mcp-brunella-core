const fs = require('fs');
const path = require('path');

// Simulated Gemini API call (you would replace this with actual Gemini API call)
// For now, it uses template strings based on the audit data.
async function run() {
  try {
    const auditPath = path.join(__dirname, 'audited_leads.json');
    if (!fs.existsSync(auditPath)) {
      console.error('Nincs audited_leads.json fájl. Várd meg, amíg az audit lefut!');
      process.exit(1);
    }

    const leads = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    console.log(`E-mail tervezetek generálása ${leads.length} leadhez...`);

    const outreachFolder = path.join(__dirname, 'outreach_drafts');
    if (!fs.existsSync(outreachFolder)) fs.mkdirSync(outreachFolder);

    leads.forEach(lead => {
      if (lead.audit && lead.audit.score < 90) {
        const draft = generateEmail(lead);
        const fileName = lead.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.md';
        fs.writeFileSync(path.join(outreachFolder, fileName), draft);
        console.log(`Tervezet elkészült: ${fileName} (Score: ${lead.audit.score})`);
      }
    });

    console.log(`\nÖsszes tervezet elmentve ide: ${outreachFolder}`);
    process.exit(0);

  } catch (err) {
    console.error('Hiba:', err.message);
  }
}

function generateEmail(lead) {
  const score = lead.audit.score || 0;
  const loadTime = (lead.audit.loadTimeMs / 1000).toFixed(1);
  const issues = [];
  if (!lead.audit.hasDescription) issues.push("hiányzó SEO meta leírás (Google nem látja pontosan, mit csinálnak)");
  if (!lead.audit.isMobileFriendly) issues.push("nem mobilbarát kialakítás");
  if (lead.audit.loadTimeMs > 3000) issues.push(`lassú betöltési idő (${loadTime} másodperc)`);

  return `
# B2B Outreach Draft: ${lead.name}
**Célpont:** ${lead.website}
**Audit Score:** ${score}/100

Tisztelt ${lead.name} Csapata!

Véletlenül akadtam rá a weboldalukra (${lead.website}) egy iparági kutatás során, és mivel a Pohánka & Társánál (pohankaestarsa.com) pont a KKV-k digitális hatékonyságára specializálódtunk, lefuttattam egy gyors technikai ellenőrzést az oldalukon.

Sajnos a méréseink alapján az oldaluk technikai pontszáma ${score}/100, ami elmarad a modern elvárásoktól. A legfontosabb pontok:
${issues.map(i => `- ${i}`).join('\n')}

Ez a gyakorlatban azt jelenti, hogy a potenciális pácienseik/ügyfeleik egy része már az oldal betöltése előtt távozik, vagy a Google hátrébb sorolja Önöket a keresőben.

**Mi a megoldás?**
Nem egy újabb drága ügynökségi szerződést ajánlok, hanem egy "Web Rescue" beavatkozást. Fix áron, 2-3 munkanap alatt felhúzzuk ezeket a mutatókat 90+ pontra, és modernizáljuk a technikai alapokat, hogy az oldal valóban termelje a profitot.

Amennyiben érdekli Önöket a részletes, ingyenes Lighthouse riport, válaszoljanak erre az e-mailre, és szívesen átküldöm!

Üdvözlettel,
József Péter Pohánka
Pohánka & Társa - MI & Web Automatizálás
pohankaestarsa.com
  `;
}

run();