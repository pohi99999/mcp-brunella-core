import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import * as dotenv from 'dotenv';
// Importáljuk a korábban megírt "Híd" függvényt
import { runBrowserTask } from '../src/tools/browserBridge.js';

dotenv.config();

// --- KONFIGURÁCIÓ ---
// Ide írd azokat az oldalakat, amiket figyelni akarsz (ez lehet több is)
const TARGET_SITES = [
    {
        url: "https://remoteok.com/remote-customer-support-jobs", 
        name: "remote_support" 
    },
    // Ide jöhetne pl. a Profession.hu vagy LinkedIn URL is
];

const SAVE_DIR = path.join(process.cwd(), '_br_temp');

// --- A LOGIKA ---
async function runDailyHarvest() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`
🌅 REGGELI MŰSZAK INDÍTÁSA [${today}]`);
    console.log("==========================================");

    // Biztosítjuk, hogy létezik a mappa
    await fs.mkdir(SAVE_DIR, { recursive: true });

    for (const site of TARGET_SITES) {
        console.log(`🤖 Robotkéz küldése ide: ${site.url}...`);

        // Payload összeállítása
        const taskPayload = {
            url: site.url,
            task: "Keresd meg az álláshirdetéseket. Gyűjtsd ki: Cég neve, Pozíció, Bér (ha van), Jelentkezési link."
        };

        try {
            // Itt történik a varázslat: A Node.js vár, amíg a Python dolgozik
            const result = await runBrowserTask(taskPayload);
            
            // Eredmény feldolgozása
            let parsedData;
            try {
                // Megpróbáljuk JSON-ként parszolni, hátha a Python már azt adott
                parsedData = JSON.parse(result);
            } catch (e) {
                // Ha a Python szöveget küldött, elmentjük nyers szövegként
                parsedData = { raw_text: result };
            }

            // Fájlba mentés: pl. _br_temp/remote_support_2026-01-30.json
            const filename = `${site.name}_${today}.json`;
            const filePath = path.join(SAVE_DIR, filename);

            await fs.writeFile(filePath, JSON.stringify(parsedData, null, 2));
            console.log(`✅ SIKER! Adatok elmentve: ${filePath}`);

        } catch (error) {
            console.error(`❌ HIBA a(z) ${site.name} feldolgozásakor:`, error);
        }
    }
    console.log("==========================================");
    console.log("☕ Műszak vége. A robot pihen holnap reggelig.\n");
}

// --- IDŐZÍTŐ ---
// A '0 8 * * *' azt jelenti: Minden nap reggel 8:00-kor
cron.schedule('0 8 * * *', () => {
    runDailyHarvest();
});

// Ha azonnal tesztelni akarod (parancssori argumentummal: --now)
if (process.argv.includes('--now')) {
    console.log("⚡ Azonnali futtatás kényszerítve...");
    runDailyHarvest();
} else {
    console.log("⏳ A 'Harvester' élesítve. Következő futás: Reggel 8:00.");
}
