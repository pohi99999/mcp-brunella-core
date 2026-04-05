import { Env } from "./types.js";
import { safeJsonParse } from "./lib/aiHelpers.js";

/**
 * EdgeCoordinator - Durable Object for real-time WebSocket communication
 *
 * Responsibilities:
 * 1. Maintain persistent WebSocket connections
 * 2. Route messages to specific clients
 * 3. Broadcast updates to all connected clients
 * 4. Manage distributed state for real-time tasks
 */
export class EdgeCoordinator implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<string, WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();

    // Restore sessions from storage if needed (optional for pure signaling)
    // this.state.blockConcurrencyWhile(async () => {
    //   // restoration logic
    // });
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept server side of the connection
      await this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Default HTTP behavior if not WebSocket
    // Useful for direct communication with the DO via HTTP
    const url = new URL(request.url);

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const payload = await request.json();
      this.broadcast(payload);
      return new Response("Broadcast sent", { status: 200 });
    }

    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  private async handleSession(webSocket: WebSocket) {
    // Generate unique session ID
    const sessionId = crypto.randomUUID();

    // Accept the WebSocket
    webSocket.accept();
    this.sessions.set(sessionId, webSocket);

    // Set up event listeners
    webSocket.addEventListener("message", async (msg) => {
      try {
        const data = safeJsonParse<Record<string, unknown> | null>(msg.data as string, null);
        if (!data) throw new Error('invalid-json');
        await this.handleMessage(sessionId, data);
      } catch (err) {
        // Handle parse error or invalid message
        try { webSocket.send(JSON.stringify({ error: "Invalid message format" })); } catch {}
      }
    });

    webSocket.addEventListener("close", () => {
      this.sessions.delete(sessionId);
    });

    webSocket.addEventListener("error", () => {
      this.sessions.delete(sessionId);
    });
  }

  private async handleMessage(sessionId: string, data: any) {
    // Handle incoming messages
    switch (data.type) {
      case "ping":
        const ws = this.sessions.get(sessionId);
        ws?.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;

      case "task:submit":
        // Handle task submission directly via WebSocket if supported
        // In current architecture, we use HTTP POST -> Worker -> DO broadcast
        break;

      default:
        // Echo or handle other types
        break;
    }
  }

  private broadcast(message: any) {
    const payload = JSON.stringify(message);
    for (const [id, ws] of this.sessions) {
      try {
        ws.send(payload);
      } catch (err) {
        // Remove dead connection
        this.sessions.delete(id);
      }
    }
  }
}
