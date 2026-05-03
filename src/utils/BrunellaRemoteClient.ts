export interface RemoteAuthResponse {
  token: string;
  expiresAt: number;
}

export interface RemoteTargetPayload {
  id: string;
  agentName: string;
  capability: string;
  description?: string;
  available: boolean;
}

export interface RemoteCommandPayload {
  id: string;
  sessionId: string;
  targetId: string;
  toolName: string;
  input: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RemoteSessionPayload {
  id: string;
  userId: string;
  targetId: string;
  createdAt: number;
  expiresAt: number;
  active: boolean;
  commands: RemoteCommandPayload[];
  metadata?: Record<string, unknown>;
}

interface RemoteTargetsResponse {
  targets?: RemoteTargetPayload[];
}

interface RemoteSessionsResponse {
  sessions?: RemoteSessionPayload[];
}

interface RemoteSessionResponse {
  session?: RemoteSessionPayload;
}

interface RemoteCommandResponse {
  command?: RemoteCommandPayload;
  commandId?: string;
}

export class BrunellaRemoteClient {
  private authToken: string | null = null;
  private authUserId: string | null = null;
  private authExpiresAt: number | null = null;

  constructor(private readonly baseUrl: string) {}

  private buildUrl(path: string): string {
    const base = this.baseUrl.replace(/\/$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  private buildHeaders(headers?: HeadersInit, hasBody = false): Record<string, string> {
    const merged: Record<string, string> = {};

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        merged[key] = value;
      });
    } else if (Array.isArray(headers)) {
      for (const [key, value] of headers) {
        merged[key] = value;
      }
    } else if (headers) {
      Object.assign(merged, headers);
    }

    if (hasBody && merged["Content-Type"] === undefined) {
      merged["Content-Type"] = "application/json";
    }

    if (this.authToken) {
      merged.Authorization = `Bearer ${this.authToken}`;
    }

    return merged;
  }

  private async readJson<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (!text.trim()) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Érvénytelen remote válasz (${response.status}): ${text.slice(0, 120)}`);
    }
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const text = await response.text();
    if (!text.trim()) {
      return response.statusText || `HTTP ${response.status}`;
    }

    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.error === "string") {
        return parsed.error;
      }
    } catch {
      // Fall through to the raw body text.
    }

    return text;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(this.buildUrl(path), {
      ...options,
      headers: this.buildHeaders(options.headers, options.body !== undefined),
    });

    if (!response.ok) {
      throw new Error(
        `Remote client request failed (${response.status}): ${await this.readErrorMessage(response)}`,
      );
    }

    return this.readJson<T>(response);
  }

  private async ensureAuth(userId: string): Promise<void> {
    const tokenStillValid =
      this.authToken !== null &&
      this.authUserId === userId &&
      (this.authExpiresAt === null || this.authExpiresAt - Date.now() > 30_000);

    if (tokenStillValid) {
      return;
    }

    await this.authenticate(userId);
  }

  clearAuth(): void {
    this.authToken = null;
    this.authUserId = null;
    this.authExpiresAt = null;
  }

  async authenticate(userId: string): Promise<RemoteAuthResponse> {
    const response = await fetch(this.buildUrl("/remote/auth/token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(
        `Remote authentication failed (${response.status}): ${await this.readErrorMessage(response)}`,
      );
    }

    const payload = await this.readJson<RemoteAuthResponse>(response);
    this.authToken = payload.token;
    this.authUserId = userId;
    this.authExpiresAt = payload.expiresAt;
    return payload;
  }

  async listTargets(userId: string): Promise<RemoteTargetPayload[]> {
    await this.ensureAuth(userId);
    const data = await this.request<RemoteTargetsResponse>("/remote/targets", {
      method: "GET",
    });
    return data.targets ?? [];
  }

  async listSessions(userId: string): Promise<RemoteSessionPayload[]> {
    await this.ensureAuth(userId);
    const query = new URLSearchParams({ userId }).toString();
    const data = await this.request<RemoteSessionsResponse>(`/remote/sessions?${query}`, {
      method: "GET",
    });
    return data.sessions ?? [];
  }

  async getSession(sessionId: string, userId: string): Promise<RemoteSessionPayload> {
    await this.ensureAuth(userId);
    const data = await this.request<RemoteSessionResponse>(
      `/remote/sessions/${encodeURIComponent(sessionId)}`,
      { method: "GET" },
    );

    if (!data.session) {
      throw new Error("Remote session response missing session");
    }

    return data.session;
  }

  async createSession(
    targetId: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<RemoteSessionPayload> {
    await this.ensureAuth(userId);
    const payload = await this.request<{ sessionId: string; expiresAt: number; targetId: string }>(
      "/remote/sessions",
      {
        method: "POST",
        body: JSON.stringify({ targetId, userId, metadata }),
      },
    );

    return this.getSession(payload.sessionId, userId);
  }

  async getCommand(commandId: string, userId: string): Promise<RemoteCommandPayload> {
    await this.ensureAuth(userId);
    const data = await this.request<RemoteCommandResponse>(
      `/remote/commands/${encodeURIComponent(commandId)}`,
      { method: "GET" },
    );

    if (!data.command) {
      throw new Error("Remote command response missing command");
    }

    return data.command;
  }

  async sendCommand(
    sessionId: string,
    targetId: string,
    toolName: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<RemoteCommandPayload> {
    await this.ensureAuth(userId);
    const payload = await this.request<RemoteCommandResponse>("/remote/commands", {
      method: "POST",
      body: JSON.stringify({ sessionId, targetId, toolName, input }),
    });

    if (!payload.commandId) {
      throw new Error("Remote command response missing commandId");
    }

    return this.getCommand(payload.commandId, userId);
  }
}
