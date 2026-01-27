import { agentManager } from "../src/agents/AgentManager.js";

async function runTest() {
    console.log("🚀 CLI Agent Mode - Python Integráció Teszt");
    
    const task = "Írj egy Python kódot, ami kiszámolja a Fibonacci sorozat első 5 elemét, és írd ki az eredményt.";
    
    console.log(`\n📋 Feladat: "${task}"`);
    
    console.log("\n🧠 Terv készítése...");
    const plan = await agentManager.createPlan(task);
    
    console.log("\n⚙️ Végrehajtás...");
    const result = await agentManager.executePlan(plan, (event, data) => {
        if (event === 'plan_step_update') {
            console.log(`  [${data.status.toUpperCase()}] ${data.agent}: ${data.description}`);
            if (data.status === 'completed' && data.result) {
                console.log(chalk.gray(`      Result: ${data.result.substring(0, 100)}...`));
            }
        }
    });

    console.log("\n🏁 Végeredmény:");
    console.log(result);
    
    process.exit(0);
}

// Chalk mock if not available in direct node execution of ts-node registered file
const chalk = {
    gray: (t: string) => t,
    yellow: (t: string) => t,
    blue: (t: string) => t,
    green: (t: string) => t,
    red: (t: string) => t
};

runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
