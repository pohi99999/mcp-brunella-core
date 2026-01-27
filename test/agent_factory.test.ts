import { AgentsDB } from '../src/database/agents_db.js';
import { AgentRouter } from '../src/agent_factory/router.js';
import { AgentSupervisor } from '../src/agent_factory/supervisor.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'test_agents.db');

async function runTest() {
    console.log(`Setting up test environment... DB Path: ${DB_PATH}`);
    
    // Clean up old DB
    if (fs.existsSync(DB_PATH)) {
        try {
            fs.unlinkSync(DB_PATH);
        } catch (e) {
            console.warn("Could not delete old DB, maybe locked:", e);
        }
    }

    // Initialize DB
    const db = new AgentsDB(DB_PATH);
    
    // Initialize Router
    const router = new AgentRouter(db);
    
    // Initialize Supervisor
    const supervisor = new AgentSupervisor(router);

    // Python script paths
    const pythonPath = 'python'; 
    const pongScript = path.resolve(__dirname, '..', 'src', 'agent_factory', 'sdk', 'python', 'pong_agent.py');
    const pingScript = path.resolve(__dirname, '..', 'src', 'agent_factory', 'sdk', 'python', 'ping_agent.py');

    console.log(`Pong Script: ${pongScript}`);
    console.log(`Ping Script: ${pingScript}`);

    console.log("Spawning Pong Agent...");
    const pongPid = supervisor.spawnAgent(pythonPath, [pongScript]);
    
    console.log("Spawning Ping Agent...");
    const pingPid = supervisor.spawnAgent(pythonPath, [pingScript]);

    console.log("Agents spawned. Waiting for interaction (5s)...");
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("Checking DB for messages...");
    
    // Use better-sqlite3 directly to verify (ESM: dynamic import)
    const { default: Database } = await import('better-sqlite3');
    const verifyDb = new Database(DB_PATH);
    
    const messages = verifyDb.prepare('SELECT * FROM messages').all();
    console.log("Messages found:", messages.length);

    const agents = verifyDb.prepare('SELECT * FROM agents').all();
    console.log("Agents found:", agents.length);

    let success = true;

    // Verify Agents Registered
    const pingAgent = agents.find((a: any) => a.id === 'ping-agent');
    const pongAgent = agents.find((a: any) => a.id === 'pong-agent');

    if (!pingAgent || !pongAgent) {
        console.error("FAIL: Agents not registered.");
        console.log("Registered agents:", agents.map((a:any) => a.id));
        success = false;
    } else {
        console.log("PASS: Agents registered.");
    }

    // Verify Message Exchange
    const pingToPong = messages.find((m: any) => m.sender_id === 'ping-agent' && m.target_id === 'pong-agent' && JSON.parse(m.payload) === 'Ping');
    const pongToPing = messages.find((m: any) => m.sender_id === 'pong-agent' && m.target_id === 'ping-agent' && JSON.parse(m.payload) === 'Pong');

    // Note: Payload is JSON stringified in DB. 'Ping' string becomes "\"Ping\"". 
    // Wait, logMessage: `JSON.stringify(msg.payload)`.
    // If msg.payload is "Ping", it becomes "\"Ping\"". 
    // JSON.parse("\"Ping\"") is "Ping".
    
    if (pingToPong) {
        console.log("PASS: Ping -> Pong message found.");
    } else {
        console.error("FAIL: Ping -> Pong message NOT found.");
        success = false;
    }

    if (pongToPing) {
        console.log("PASS: Pong -> Ping message found.");
    } else {
        console.error("FAIL: Pong -> Ping message NOT found.");
        success = false;
    }
    
    if (messages.length > 0 && (!pingToPong || !pongToPing)) {
        console.log("First 5 messages:", messages.slice(0, 5));
    }

    // Cleanup
    supervisor.killAgent(pongPid);
    supervisor.killAgent(pingPid);
    
    verifyDb.close();
    db.close();

    if (success) {
        console.log("TEST PASSED");
        process.exit(0);
    } else {
        console.error("TEST FAILED");
        process.exit(1);
    }
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});