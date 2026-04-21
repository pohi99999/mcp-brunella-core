import { agentManager } from '../src/agents/AgentManager.js';
import { logInfo, logError } from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

async function runSophisticationTest() {
    console.log("\n🚀 BRUNELLA KIFINOMULTSÁGI TESZT INDÍTÁSA...\n");

    try {
        // 1. Teszt: Innovation Bridge (Kreativitás ellenőrzése)
        console.log("--- 🌉 Teszt 1: Innovation Bridge ---");
        const innovationResult = await agentManager.delegate('InnovationBridge', 
            "Túl sokat várnak a páciensek a fogászati rendelőben a recepció előtt."
        ) as any;
        
        if (innovationResult.success) {
            console.log("✅ SIKER: Az innovációs híd megépült.");
            console.log("💡 Absztrakt kihívás:", innovationResult.data.problem.abstractChallenge);
            console.log("🧠 Első analógia:", innovationResult.data.solutions[0].sourceIndustry);
        } else {
            console.log("❌ HIBA az Innovation Bridge-nél:", innovationResult.message);
        }

        console.log("\n");

        // 2. Teszt: Property Visionary (Üzleti stratégia ellenőrzése)
        console.log("--- 🏗️ Teszt 2: Property Visionary ---");
        const propertyResult = await agentManager.delegate('PropertyVisionary', 
            "15 hektár iparterület az M1-es autópálya mellett, logisztikai csarnok építési engedéllyel."
        ) as any;

        if (propertyResult.success) {
            console.log("✅ SIKER: Vevővadászat és stratégia kész.");
            const buyerProfile = propertyResult.data.analysis?.buyerProfile || propertyResult.data.buyerProfile || "N/A";
            console.log("🎯 Célzott profil:", buyerProfile.substring(0, 100) + "...");
            console.log("👥 Talált vevőjelöltek száma:", propertyResult.data.leads?.length || 0);
        } else {
            console.log("❌ HIBA a Property Visionary-nál:", propertyResult.message);
        }

        console.log("\n✨ KIFINOMULTSÁGI TESZT BEFEJEZŐDÖTT.");
        process.exit(0);

    } catch (error: any) {
        console.error("💀 Kritikus hiba a teszt során:", error.message);
        process.exit(1);
    }
}

runSophisticationTest();
