interface SwarmSessionHistoryEntry {
  kind: string;
  at: string;
  details: Record<string, unknown>;
}

interface SwarmArtifactEntry {
  artifactId: string;
  name: string;
  content: string;
  createdAt: string;
}

interface SwarmHandoffEntry {
  targetAgent: string;
  at: string;
  reason?: string;
}

export interface SwarmSession {
  sessionId: string;
  activeAgent: string;
  history: SwarmSessionHistoryEntry[];
  artifacts: SwarmArtifactEntry[];
  handoffs: SwarmHandoffEntry[];
  createdAt: string;
  updatedAt: string;
}

interface SwarmCreatePayload {
  sessionId?: string;
  activeAgent?: string;
}

interface SwarmHandoffPayload {
  sessionId: string;
  targetAgent: string;
  reason?: string;
}

interface SwarmArtifactPayload {
  sessionId: string;
  artifactId?: string;
  name: string;
  content: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export class SwarmCoordinator implements DurableObject {
  constructor(private readonly state: DurableObjectState, private readonly env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return this.handleWebSocket(request);
    }

    if (url.pathname === "/swarm/create" && request.method === "POST") {
      return this.createSession(request);
    }

    if (url.pathname === "/swarm/handoff" && request.method === "POST") {
      return this.handoffSession(request);
    }

    if (url.pathname === "/swarm/artifact" && request.method === "POST") {
      return this.storeArtifact(request);
    }

    return json({ error: "Not found" }, 404);
  }

  private async loadSession(sessionId: string): Promise<SwarmSession | null> {
    return this.state.storage.get<SwarmSession>(`session:${sessionId}`);
  }

  private async saveSession(session: SwarmSession): Promise<void> {
    await this.state.storage.put(`session:${session.sessionId}`, session);
  }

  private async createSession(request: Request): Promise<Response> {
    const body = (await request.json()) as SwarmCreatePayload;
    const now = new Date().toISOString();
    const sessionId = body.sessionId ?? `swarm-${crypto.randomUUID()}`;
    const session: SwarmSession = {
      sessionId,
      activeAgent: body.activeAgent ?? "unknown",
      history: [
        {
          kind: "session_created",
          at: now,
          details: { activeAgent: body.activeAgent ?? "unknown" },
        },
      ],
      artifacts: [],
      handoffs: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.saveSession(session);
    await this.broadcast({ type: "session_created", sessionId, activeAgent: session.activeAgent });
    return json({ status: "session_created", sessionId, activeAgent: session.activeAgent }, 201);
  }

  private async handoffSession(request: Request): Promise<Response> {
    const body = (await request.json()) as SwarmHandoffPayload;
    const session = await this.loadSession(body.sessionId);
    if (!session) {
      return json({ error: "Session not found" }, 404);
    }

    const now = new Date().toISOString();
    session.activeAgent = body.targetAgent;
    session.handoffs.push({ targetAgent: body.targetAgent, at: now, reason: body.reason });
    session.history.push({
      kind: "handoff",
      at: now,
      details: { targetAgent: body.targetAgent, reason: body.reason ?? null },
    });
    session.updatedAt = now;

    await this.saveSession(session);
    await this.broadcast({ type: "handoff", sessionId: session.sessionId, targetAgent: body.targetAgent });
    return json({ status: "handoff", sessionId: session.sessionId, targetAgent: body.targetAgent });
  }

  private async storeArtifact(request: Request): Promise<Response> {
    const body = (await request.json()) as SwarmArtifactPayload;
    const session = await this.loadSession(body.sessionId);
    if (!session) {
      return json({ error: "Session not found" }, 404);
    }

    const artifact = {
      artifactId: body.artifactId ?? `artifact-${crypto.randomUUID()}`,
      name: body.name,
      content: body.content,
      createdAt: new Date().toISOString(),
    };
    session.artifacts.push(artifact);
    session.history.push({
      kind: "artifact_stored",
      at: artifact.createdAt,
      details: { artifactId: artifact.artifactId, name: artifact.name, kind: "artifact" },
    });
    session.updatedAt = artifact.createdAt;

    await this.saveSession(session);
    await this.broadcast({ type: "artifact_stored", sessionId: session.sessionId, artifactId: artifact.artifactId });
    return json({ status: "artifact_stored", sessionId: session.sessionId, artifactId: artifact.artifactId });
  }

  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private acceptWebSocket(webSocket: WebSocket): void {
    webSocket.accept();
  }

  private async broadcast(message: Record<string, unknown>): Promise<void> {
    const clients = (await this.state.storage.get<WebSocket[]>("clients")) ?? [];
    for (const client of clients) {
      try {
        client.send(JSON.stringify(message));
      } catch {
        continue;
      }
    }
    void this.env;
  }
}
