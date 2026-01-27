import { AgentsDB } from '../database/agents_db.js';
import { AgentSession, JsonRpcRequest, JsonRpcResponse } from '../types/buap.js';
import { v4 as uuidv4 } from 'uuid';

export class AgentRouter {
    private sessions: Map<string, AgentSession> = new Map();
    private db: AgentsDB;

    constructor(db: AgentsDB) {
        this.db = db;
    }

    public registerSession(session: AgentSession) {
        // A session might not be authenticated yet.
        // We track it by some connection ID internally if needed, 
        // but typically we wait for the handshake 'agent.register'.
    }

    public async handleMessage(session: AgentSession, message: JsonRpcRequest) {
        try {
            switch (message.method) {
                case 'agent.register':
                    await this.handleRegister(session, message);
                    break;
                case 'agent.delegate':
                    await this.handleDelegate(session, message);
                    break;
                case 'agent.message':
                    await this.handleDirectMessage(session, message);
                    break;
                default:
                    this.sendError(session, message.id, -32601, 'Method not found');
            }
        } catch (error: any) {
            console.error('Router error:', error);
            this.sendError(session, message.id, -32603, 'Internal error: ' + error.message);
        }
    }

    private async handleRegister(session: AgentSession, message: JsonRpcRequest) {
        const { agent_id, capabilities } = message.params;
        
        if (!agent_id) {
            return this.sendError(session, message.id, -32602, 'Missing agent_id');
        }

        // Register in DB
        this.db.registerAgent({ id: agent_id, name: agent_id, capabilities }); // Using ID as name for now
        
        // Update session map
        this.sessions.set(agent_id, session);
        session.id = agent_id; // Bind session to agent ID

        this.sendResult(session, message.id, { status: 'registered' });
        console.log(`Agent registered: ${agent_id}`);
    }

    private async handleDelegate(session: AgentSession, message: JsonRpcRequest) {
        const { target_agent_id, task } = message.params;
        const targetSession = this.sessions.get(target_agent_id);

        if (!targetSession) {
            return this.sendError(session, message.id, -32001, 'Target agent not found or offline');
        }

        // Log message
        const msgId = uuidv4();
        this.db.logMessage({
            id: msgId,
            sender_id: session.id,
            target_id: target_agent_id,
            type: 'delegate',
            payload: task
        });

        // Forward to target (as a notification or request?)
        // In this simple version, we forward it as a request to the target.
        // We need to map the response back. This requires stateful routing (pending requests).
        // For simplicity: We just fire and forget or let the target reply directly if we support bidirectional routing IDs.
        
        targetSession.send({
            jsonrpc: '2.0',
            method: 'agent.task',
            params: {
                from: session.id,
                task: task
            },
            id: message.id // We reuse the ID? No, IDs must be unique per connection.
            // Complex routing skipped for "Vertical Slice".
            // We'll just confirm receipt to Sender.
        });

        this.sendResult(session, message.id, { status: 'delegated', message_id: msgId });
    }

    private async handleDirectMessage(session: AgentSession, message: JsonRpcRequest) {
        const { target_agent_id, content } = message.params;
        const targetSession = this.sessions.get(target_agent_id);

        if (!targetSession) {
            return this.sendError(session, message.id, -32001, 'Target agent not found');
        }

        // Log message
        const msgId = uuidv4();
        this.db.logMessage({
            id: msgId,
            sender_id: session.id,
            target_id: target_agent_id,
            type: 'message',
            payload: content
        });

        targetSession.send({
            jsonrpc: '2.0',
            method: 'agent.on_message',
            params: {
                from: session.id,
                content: content
            }
        });

        this.sendResult(session, message.id, { status: 'sent', message_id: msgId });
    }

    private sendResult(session: AgentSession, id: any, result: any) {
        session.send({ jsonrpc: '2.0', result, id });
    }

    private sendError(session: AgentSession, id: any, code: number, message: string) {
        session.send({ jsonrpc: '2.0', error: { code, message }, id });
    }
}
