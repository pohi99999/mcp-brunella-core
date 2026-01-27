import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AgentsDB {
    private db: Database.Database;

    constructor(dbPath: string = 'agents.db') {
        this.db = new Database(dbPath);
        this.init();
    }

    private init() {
        const schemaPath = path.join(__dirname, 'agents_schema.sql');
        // If run from build, schema might be in ../src/database or copied. 
        // For dev (ts-node), it's in src/database.
        // Let's try to find it.
        let schema: string;
        try {
            schema = fs.readFileSync(schemaPath, 'utf-8');
        } catch (e) {
             // Fallback for build structure if needed, or simple error
             console.warn(`Schema file not found at ${schemaPath}, trying relative...`);
             schema = fs.readFileSync(path.join(process.cwd(), 'src', 'database', 'agents_schema.sql'), 'utf-8');
        }
        this.db.exec(schema);
    }

    public registerAgent(agent: { id: string, name: string, capabilities: any }) {
        const stmt = this.db.prepare(`
            INSERT INTO agents (id, name, capabilities, status, last_heartbeat)
            VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                status = 'active',
                last_heartbeat = CURRENT_TIMESTAMP,
                capabilities = excluded.capabilities
        `);
        stmt.run(agent.id, agent.name, JSON.stringify(agent.capabilities));
    }

    public updateHeartbeat(agentId: string) {
        const stmt = this.db.prepare(`
            UPDATE agents SET last_heartbeat = CURRENT_TIMESTAMP, status = 'active' WHERE id = ?
        `);
        stmt.run(agentId);
    }

    public logMessage(msg: { id: string, sender_id: string, target_id: string, type: string, payload: any }) {
        const stmt = this.db.prepare(`
            INSERT INTO messages (id, sender_id, target_id, type, payload)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(msg.id, msg.sender_id, msg.target_id, msg.type, JSON.stringify(msg.payload));
    }
    
    public getAgent(id: string) {
        const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
        const agent = stmt.get(id) as any;
        if (agent && agent.capabilities) {
            agent.capabilities = JSON.parse(agent.capabilities);
        }
        return agent;
    }

    public getAllAgents() {
        const stmt = this.db.prepare('SELECT * FROM agents');
        const agents = stmt.all() as any[];
        return agents.map(agent => ({
            ...agent,
            capabilities: agent.capabilities ? JSON.parse(agent.capabilities) : []
        }));
    }

    public close() {
        this.db.close();
    }
}
