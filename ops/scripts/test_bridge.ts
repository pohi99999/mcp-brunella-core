import { runBrowserTask } from '../src/tools/browserBridge.js';
import * as dotenv from 'dotenv';

// Környezeti változók betöltése
dotenv.config();

async function smokeTest() {
    console.log("🔥 SMOKE TEST INDÍTÁSA: Node.js -> Python Híd...");
    console.log("------------------------------------------------");
    
    // Egy nagyon egyszerű, gyors feladat
    const testTask = "Nyisd meg az 'example.com' oldalt, és mondd meg, mi a H1 címsor szövege.";

    const startTime = Date.now();

    try {
        console.log(`📡 Küldés a Python munkásnak: "${testTask}"`);
        const result = await runBrowserTask(testTask);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log("------------------------------------------------");
        console.log(`✅ SIKER! A válasz megérkezett (${duration}s alatt):`);
        console.log(`📝 Robot válasza: ${result}`);
        
        if (result.toLowerCase().includes("example domain")) {
            console.log("🎯 Validáció: A robot valóban látta az oldalt!");
        } else {
            console.warn("⚠️ Figyelem: A válasz gyanús. Ellenőrizd a kimenetet!");
        }

    } catch (error) {
        console.error("------------------------------------------------");
        console.error("❌ KRITIKUS HIBA! A híd leszakadt.");
        console.error("🔍 Hiba részletei:", error);
        console.log("\nTippek a javításhoz:");
        console.log("1. Telepítetted a Python csomagokat? (pip install browser-use langchain-google-generative-ai)");
        console.log("2. Jó a PYTHON_PATH a .env fájlban? (Jelenleg: " + (process.env.PYTHON_PATH || 'python') + ")");
        console.log("3. Van érvényes GOOGLE_API_KEY?");
    }
}

smokeTest();
