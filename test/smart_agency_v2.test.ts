import { agentManager } from "../src/agents/AgentManager.js";
import { Logger } from "../src/utils/logger.js";

async function runTest() {
    console.log("🚀 Smart Agency V2 - Éles Teszt Indítása");
    
    const task = "Nézd meg a pipeline.log tartalmát a logs mappában, keress benne hibákat, és foglald össze a tapasztalatokat a Python shell segítségével.";
    
    console.log(`\n📋 Feladat: "${task}"`);
    
    console.log("\n🧠 Terv készítése...");
    const plan = await agentManager.createPlan(task);
    
    console.log("\n🗺️ Generált Terv:");
    plan.steps.forEach(s => console.log(`  [${s.agent}] - ${s.description}`));

    console.log("\n⚙️ Végrehajtás...");
    const result = await agentManager.executePlan(plan, (event, data) => {
        if (event === 'plan_step_update') {
            console.log(`  [Event: ${event}] Step ${data.id} is now ${data.status}`);
        }
    });

    console.log("\n🏁 Végeredmény:");
    console.log(result);
    
    process.exit(0);
}

runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});

