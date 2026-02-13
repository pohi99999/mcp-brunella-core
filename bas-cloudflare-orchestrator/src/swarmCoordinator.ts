/**
 * SwarmCoordinator — Durable Object for BAS Swarm Sessions
 *
 * Manages persistent multi-agent swarm sessions on the Edge:
 * - Shared context (history, artifacts) across agent handoffs
 * - WebSocket real-time updates to connected clients
 * - Handoff tracking and artifact storage
 *
 * Endpoints (relative to DO stub):
 *   POST /swarm/create       — Create a new swarm session
 *   GET  /swarm/:id          — Get session state
 *   POST /swarm/:id/handoff  — Register agent handoff
 *   POST /swarm/:id/artifact — Store shared artifact
 *   GET  /swarm/:id/ws       — WebSocket upgrade for real-time events
 */

interface SwarmSession {
  sessionId: string;
  status: "active" | "completed" | "failed";
  activeAgent: string;
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    agent?: string;
    timestamp: string;
  }>;
  artifacts: Record<string, unknown>;
  handoffs: Array<{
    from: string;
    to: string;
    reason: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export class SwarmCoordinator implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<string, SwarmSession> = new Map();
  private sockets: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;

    // Restore sessions from storage on wake
    this.state.blockConcurrencyWhile(async () => {
      const stored =
        await this.state.storage.get<Map<string, SwarmSession>>("sessions");
      if (stored) {
        this.sessions = stored;
      }
    });
  }

  private async persist(): Promise<void> {
    await this.state.storage.put("sessions", this.sessions);
  }

  private broadcast(event: Record<string, unknown>): void {
    const msg = JSON.stringify(event);
    for (const ws of this.sockets) {
      try {
        ws.send(msg);
      } catch {
        this.sockets.delete(ws);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Upgrade",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /swarm/create
    if (path === "/swarm/create" && request.method === "POST") {
      const body = (await request.json()) as {
        initialAgent?: string;
        context?: Record<string, unknown>;
      };

      const sessionId = `swarm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const session: SwarmSession = {
        sessionId,
        status: "active",
        activeAgent: body.initialAgent ?? "orchestrator",
        history: [],
        artifacts: body.context ?? {},
        handoffs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.sessions.set(sessionId, session);
      await this.persist();

      this.broadcast({ event: "session_created", sessionId });

      return Response.json(
        { success: true, sessionId, session },
        { headers: corsHeaders },
      );
    }

    // Route /swarm/:id/*
    const sessionMatch = path.match(/^\/swarm\/([^/]+)(?:\/(.*))?$/);
    if (!sessionMatch) {
      return Response.json(
        { error: "Invalid swarm path" },
        { status: 400, headers: corsHeaders },
      );
    }

    const sessionId = sessionMatch[1];
    const subPath = sessionMatch[2] ?? "";

    // GET /swarm/:id
    if (request.method === "GET" && subPath === "") {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return Response.json(
          { error: "Session not found" },
          { status: 404, headers: corsHeaders },
        );
      }
      return Response.json(
        { success: true, session },
        { headers: corsHeaders },
      );
    }

    // GET /swarm/:id/ws — WebSocket upgrade
    if (request.method === "GET" && subPath === "ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return Response.json(
          { error: "Expected WebSocket upgrade" },
          { status: 426, headers: corsHeaders },
        );
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      this.state.acceptWebSocket(server);
      this.sockets.add(server);

      server.addEventListener("close", () => {
        this.sockets.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // POST /swarm/:id/handoff
    if (request.method === "POST" && subPath === "handoff") {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return Response.json(
          { error: "Session not found" },
          { status: 404, headers: corsHeaders },
        );
      }

      const body = (await request.json()) as {
        targetAgent: string;
        reason: string;
        message?: string;
        contextUpdates?: Record<string, unknown>;
      };

      if (!body.targetAgent || !body.reason) {
        return Response.json(
          { error: "targetAgent and reason required" },
          { status: 400, headers: corsHeaders },
        );
      }

      const handoff = {
        from: session.activeAgent,
        to: body.targetAgent,
        reason: body.reason,
        timestamp: new Date().toISOString(),
      };

      session.handoffs.push(handoff);
      session.activeAgent = body.targetAgent;

      if (body.message) {
        session.history.push({
          role: "system",
          content: `Handoff: ${session.handoffs[session.handoffs.length - 1].from} → ${body.targetAgent}: ${body.reason}`,
          agent: body.targetAgent,
          timestamp: new Date().toISOString(),
        });
      }

      if (body.contextUpdates) {
        Object.assign(session.artifacts, body.contextUpdates);
      }

      session.updatedAt = new Date().toISOString();
      await this.persist();

      this.broadcast({
        event: "handoff",
        sessionId,
        handoff,
        activeAgent: body.targetAgent,
      });

      return Response.json(
        { success: true, handoff, session },
        { headers: corsHeaders },
      );
    }

    // POST /swarm/:id/artifact
    if (request.method === "POST" && subPath === "artifact") {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return Response.json(
          { error: "Session not found" },
          { status: 404, headers: corsHeaders },
        );
      }

      const body = (await request.json()) as {
        key: string;
        value: unknown;
        agent?: string;
      };

      if (!body.key) {
        return Response.json(
          { error: "key required" },
          { status: 400, headers: corsHeaders },
        );
      }

      session.artifacts[body.key] = body.value;
      session.updatedAt = new Date().toISOString();

      session.history.push({
        role: "system",
        content: `Artifact stored: "${body.key}" by ${body.agent ?? session.activeAgent}`,
        agent: body.agent ?? session.activeAgent,
        timestamp: new Date().toISOString(),
      });

      await this.persist();

      this.broadcast({
        event: "artifact_stored",
        sessionId,
        key: body.key,
        agent: body.agent ?? session.activeAgent,
      });

      return Response.json(
        { success: true, key: body.key, session },
        { headers: corsHeaders },
      );
    }

    return Response.json(
      { error: "Unknown swarm sub-route" },
      { status: 404, headers: corsHeaders },
    );
  }
}
