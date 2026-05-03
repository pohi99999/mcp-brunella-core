import { readFileSync } from "fs";
import { isAbsolute, resolve } from "path";
import { logError, logInfo, logWarn } from "@packages/utils/logger.js";
import { mcpClientManager } from "@packages/utils/mcpClientManager.js";

export interface McpServerEnv {
  [key: string]: string;
}

export interface McpServerConfig {
  name: string;
  transport: "self" | "stdio" | "http";
  command?: string;
  args: string[];
  url?: string;
  env?: McpServerEnv;
  envFromHost?: Record<string, string[]>;
  cwd?: string;
  description?: string;
  autoStart: boolean;
  disabled: boolean;
  required: boolean;
  requiredEnv: string[];
  platforms?: NodeJS.Platform[];
  connectRetries: number;
  retryDelayMs: number;
}

export interface ServerStatus {
  name: string;
  status: "running" | "stopped" | "starting" | "error" | "disabled" | "skipped";
  transport: "self" | "stdio" | "http";
  autoStart: boolean;
  pid: number | null;
  description?: string;
  error?: string;
}

export interface McpServerReadiness {
  name: string;
  transport: "self" | "stdio" | "http";
  autoStart: boolean;
  required: boolean;
  disabled: boolean;
  canStart: boolean;
  readinessState: "ready" | "action_required" | "disabled" | "unsupported";
  platformSupported: boolean;
  supportedPlatforms?: NodeJS.Platform[];
  requiredEnv: string[];
  missingRequiredEnv: string[];
  blockers: string[];
  actionableBlockers: string[];
  inactiveReason?: string;
  command?: string;
  url?: string;
  description?: string;
}

const AUTO_START_DISABLED_VALUES = new Set(["0", "false", "no", "off"]);
const SUPPORTED_PLATFORMS: ReadonlySet<NodeJS.Platform> = new Set([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "openbsd",
  "sunos",
  "win32",
  "cygwin",
  "netbsd",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

export class McpProcessManager {
  private serverStatuses = new Map<string, ServerStatus>();
  private configs = new Map<string, McpServerConfig>();
  private autoStartPromise: Promise<void> | null = null;

  async loadConfig(): Promise<McpServerConfig[]> {
    try {
      const configPath = resolve(process.cwd(), "mcp_servers.json");
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error("mcp_servers.json must contain an array");
      }

      const normalized = parsed
        .map((entry, index) => this.normalizeConfig(entry, index))
        .filter((entry): entry is McpServerConfig => entry !== null);

      this.configs = new Map(normalized.map((config) => [config.name, config]));
      this.serverStatuses.clear();

      for (const config of normalized) {
        this.serverStatuses.set(config.name, this.createInitialStatus(config));
      }

      logInfo("MCP", `Loaded ${normalized.length} MCP server config(s)`);
      return normalized;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn("MCP", `Could not load mcp_servers.json: ${message}`);
      this.configs.clear();
      this.serverStatuses.clear();
      return [];
    }
  }

  async startAll(): Promise<void> {
    if (this.configs.size === 0) {
      await this.loadConfig();
    }

    const candidates = Array.from(this.configs.values()).filter(
      (config) => !config.disabled,
    );

    await Promise.allSettled(
      candidates.map((config) => this.startServer(config.name)),
    );
  }

  async startAutoStartServers(): Promise<void> {
    if (this.autoStartPromise) {
      return this.autoStartPromise;
    }

    this.autoStartPromise = this.runAutoStart().finally(() => {
      this.autoStartPromise = null;
    });

    return this.autoStartPromise;
  }

  private async runAutoStart(): Promise<void> {
    if (!this.isAutoStartEnabled()) {
      logInfo("MCP", "MCP auto-start disabled by environment");
      return;
    }

    if (this.configs.size === 0) {
      await this.loadConfig();
    }

    const autoStartConfigs = Array.from(this.configs.values()).filter(
      (config) => config.autoStart && !config.disabled,
    );

    if (autoStartConfigs.length === 0) {
      logInfo("MCP", "No MCP servers marked for auto-start");
      return;
    }

    logInfo(
      "MCP",
      `Auto-starting ${autoStartConfigs.length} MCP server(s) in background`,
    );

    await Promise.allSettled(
      autoStartConfigs.map((config) => this.startServer(config.name)),
    );
  }

  async startServer(name: string): Promise<boolean> {
    const config = this.configs.get(name);
    if (!config) {
      logError("MCP", `Server config not found: ${name}`);
      return false;
    }

    const currentStatus = this.serverStatuses.get(name);
    if (currentStatus?.status === "running" || currentStatus?.status === "starting") {
      return true;
    }

    if (config.disabled) {
      this.serverStatuses.set(name, {
        ...this.createInitialStatus(config),
        status: "disabled",
      });
      logWarn("MCP", `Server ${name} is disabled`);
      return false;
    }

    if (config.transport === "self") {
      this.markInternalServerRunning(name);
      return true;
    }

    this.serverStatuses.set(name, {
      ...this.createInitialStatus(config),
      status: "starting",
    });

    if (config.platforms && !config.platforms.includes(process.platform)) {
      const message = `Skipping ${name}: platform ${process.platform} not supported`;
      this.serverStatuses.set(name, {
        ...this.createInitialStatus(config),
        status: "skipped",
        error: message,
      });
      logInfo("MCP", message);
      return false;
    }

    const resolvedEnv = this.resolveEnvironment(config);
    if (resolvedEnv.missingRequired.length > 0) {
      const message = `Missing required environment for ${name}: ${resolvedEnv.missingRequired.join(", ")}`;
      this.serverStatuses.set(name, {
        ...this.createInitialStatus(config),
        status: "error",
        error: message,
      });
      logWarn("MCP", message);
      if (config.required) {
        throw new Error(message);
      }
      return false;
    }

    const attempts = Math.max(1, config.connectRetries + 1);
    const retryDelayMs = Math.max(0, config.retryDelayMs);

    let lastError = "Unknown MCP connection error";

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const connection = await (async () => {
          if (config.transport === "http") {
            const url = this.resolveTemplate(config.url ?? "");
            logInfo("MCP", `Connecting remote MCP server: ${name} (${url})`);
            return mcpClientManager.connectHttp({
              name,
              url,
              onClose: () => {
                this.handleTransportClose(name);
              },
              onError: (error) => {
                this.handleTransportError(name, error);
              },
            });
          }

          const args = config.args.map((arg) => this.resolveTemplate(arg));
          const cwd = this.resolveWorkingDirectory(config.cwd);
          logInfo(
            "MCP",
            `Starting external MCP server: ${name} (${config.command ?? ""} ${args.join(" ")})`,
          );
          return mcpClientManager.connectStdio({
            name,
            command: config.command ?? "",
            args,
            env: resolvedEnv.env,
            cwd,
            onClose: () => {
              this.handleTransportClose(name);
            },
            onError: (error) => {
              this.handleTransportError(name, error);
            },
          });
        })();

        this.serverStatuses.set(name, {
          ...this.createInitialStatus(config),
          status: "running",
          pid: connection.pid,
        });
        logInfo("MCP", `MCP server connected: ${name}`);
        return true;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < attempts) {
          logWarn(
            "MCP",
            `Failed to start ${name} on attempt ${attempt}/${attempts}. Retrying in ${retryDelayMs}ms: ${lastError}`,
          );
          await delay(retryDelayMs);
          continue;
        }
      }
    }

    this.serverStatuses.set(name, {
      ...this.createInitialStatus(config),
      status: "error",
      error: lastError,
    });
    logError("MCP", `Failed to start MCP server ${name}: ${lastError}`);

    if (config.required) {
      throw new Error(lastError);
    }

    return false;
  }

  markInternalServerRunning(name: string = "brunella-core"): void {
    const config = this.configs.get(name);
    this.serverStatuses.set(name, {
      name,
      status: "running",
      transport: config?.transport ?? "self",
      autoStart: config?.autoStart ?? true,
      pid: process.pid,
      description: config?.description,
    });
  }

  markInternalServerStopped(name: string = "brunella-core"): void {
    const config = this.configs.get(name);
    this.serverStatuses.set(name, {
      name,
      status: "stopped",
      transport: config?.transport ?? "self",
      autoStart: config?.autoStart ?? true,
      pid: null,
      description: config?.description,
    });
  }

  async stopServer(name: string): Promise<void> {
    const config = this.configs.get(name);
    if (config?.transport === "self") {
      this.markInternalServerStopped(name);
      return;
    }

    const current = this.serverStatuses.get(name);
    this.serverStatuses.set(name, {
      name,
      status: config?.disabled ? "disabled" : "stopped",
      transport: config?.transport ?? current?.transport ?? "stdio",
      autoStart: config?.autoStart ?? current?.autoStart ?? false,
      pid: null,
      description: config?.description ?? current?.description,
    });

    try {
      await mcpClientManager.disconnect(name);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn("MCP", `Error disconnecting ${name}: ${message}`);
    }

    this.serverStatuses.set(name, {
      name,
      status: config?.disabled ? "disabled" : "stopped",
      transport: config?.transport ?? current?.transport ?? "stdio",
      autoStart: config?.autoStart ?? current?.autoStart ?? false,
      pid: null,
      description: config?.description ?? current?.description,
    });
    logInfo("MCP", `Server stopped: ${name}`);
  }

  async stopAll(): Promise<void> {
    const activeServers = Array.from(this.serverStatuses.values()).filter(
      (status) => status.status === "running" || status.status === "starting",
    );

    for (const status of activeServers) {
      await this.stopServer(status.name);
    }
  }

  getServersStatus(): ServerStatus[] {
    return Array.from(this.serverStatuses.values());
  }

  getServersReadiness(): McpServerReadiness[] {
    return Array.from(this.configs.values()).map((config) => {
      const platformSupported = !config.platforms || config.platforms.includes(process.platform);
      const missingRequiredEnv = this.resolveEnvironment(config).missingRequired;
      const blockers: string[] = [];
      const actionableBlockers: string[] = [];
      let readinessState: McpServerReadiness["readinessState"] = "ready";
      let inactiveReason: string | undefined;

      if (config.disabled) {
        blockers.push("disabled in mcp_servers.json");
        readinessState = "disabled";
        inactiveReason = "Disabled intentionally in mcp_servers.json";
      }

      if (!platformSupported) {
        blockers.push(`platform ${process.platform} not supported`);
        if (readinessState === "ready") {
          readinessState = "unsupported";
          inactiveReason = `Platform ${process.platform} is not in supported platforms`;
        }
      }

      if (missingRequiredEnv.length > 0) {
        blockers.push(`missing required env: ${missingRequiredEnv.join(", ")}`);
        if (readinessState === "ready") {
          readinessState = "action_required";
          actionableBlockers.push(`missing required env: ${missingRequiredEnv.join(", ")}`);
        }
      }

      return {
        name: config.name,
        transport: config.transport,
        autoStart: config.autoStart,
        required: config.required,
        disabled: config.disabled,
        canStart: readinessState === "ready",
        readinessState,
        platformSupported,
        supportedPlatforms: config.platforms,
        requiredEnv: [...config.requiredEnv],
        missingRequiredEnv,
        blockers,
        actionableBlockers,
        inactiveReason,
        command: config.command,
        url: config.url,
        description: config.description,
      };
    });
  }

  private handleTransportClose(name: string): void {
    const current = this.serverStatuses.get(name);
    if (!current) {
      return;
    }

    if (current.status === "stopped" || current.status === "disabled") {
      return;
    }

    this.serverStatuses.set(name, {
      ...current,
      status: "stopped",
      pid: null,
    });
    logWarn("MCP", `MCP server disconnected: ${name}`);
  }

  private handleTransportError(name: string, error: Error): void {
    const current = this.serverStatuses.get(name);
    if (!current) {
      return;
    }

    this.serverStatuses.set(name, {
      ...current,
      status: "error",
      pid: null,
      error: error.message,
    });
  }

  private isAutoStartEnabled(): boolean {
    const envValue = process.env.MCP_AUTO_START?.trim().toLowerCase();
    if (envValue) {
      return !AUTO_START_DISABLED_VALUES.has(envValue);
    }

    return process.env.NODE_ENV !== "test" && process.env.CI !== "true";
  }

  private createInitialStatus(config: McpServerConfig): ServerStatus {
    return {
      name: config.name,
      status: config.disabled ? "disabled" : "stopped",
      transport: config.transport,
      autoStart: config.autoStart,
      pid: null,
      description: config.description,
    };
  }

  private normalizeConfig(
    entry: unknown,
    index: number,
  ): McpServerConfig | null {
    if (!isRecord(entry)) {
      logWarn("MCP", `Skipping invalid MCP config at index ${index}`);
      return null;
    }

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (name.length === 0) {
      logWarn("MCP", `Skipping unnamed MCP config at index ${index}`);
      return null;
    }

    const transport =
      entry.transport === "self"
        ? "self"
        : entry.transport === "http"
          ? "http"
          : "stdio";
    const command =
      transport === "stdio" && typeof entry.command === "string"
        ? entry.command
        : undefined;
    const url =
      transport === "http" && typeof entry.url === "string"
        ? entry.url.trim()
        : undefined;

    if (transport === "stdio" && !command) {
      logWarn("MCP", `Skipping MCP config "${name}": missing command`);
      return null;
    }

    if (transport === "http" && !url) {
      logWarn("MCP", `Skipping MCP config "${name}": missing url`);
      return null;
    }

    const args = isStringArray(entry.args) ? entry.args : [];
    const env = this.normalizeStringRecord(entry.env);
    const envFromHost = this.normalizeStringArrayRecord(entry.envFromHost);
    const requiredEnv = isStringArray(entry.requiredEnv) ? entry.requiredEnv : [];
    const platforms = this.normalizePlatforms(entry.platforms);
    const connectRetries =
      typeof entry.connectRetries === "number" && Number.isFinite(entry.connectRetries)
        ? Math.max(0, Math.trunc(entry.connectRetries))
        : 0;
    const retryDelayMs =
      typeof entry.retryDelayMs === "number" && Number.isFinite(entry.retryDelayMs)
        ? Math.max(0, Math.trunc(entry.retryDelayMs))
        : 1000;

    return {
      name,
      transport,
      command,
      args,
      url,
      env,
      envFromHost,
      cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      description: typeof entry.description === "string" ? entry.description : undefined,
      autoStart: entry.autoStart === true,
      disabled: entry.disabled === true,
      required: entry.required === true,
      requiredEnv,
      platforms,
      connectRetries,
      retryDelayMs,
    };
  }

  private normalizeStringRecord(value: unknown): Record<string, string> | undefined {
    if (!isRecord(value)) {
      return undefined;
    }

    const normalized: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "string") {
        normalized[key] = entry;
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private normalizeStringArrayRecord(
    value: unknown,
  ): Record<string, string[]> | undefined {
    if (!isRecord(value)) {
      return undefined;
    }

    const normalized: Record<string, string[]> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isStringArray(entry)) {
        normalized[key] = entry;
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private normalizePlatforms(value: unknown): NodeJS.Platform[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const platforms = value.filter(
      (platform): platform is NodeJS.Platform =>
        typeof platform === "string" && SUPPORTED_PLATFORMS.has(platform as NodeJS.Platform),
    );

    return platforms.length > 0 ? platforms : undefined;
  }

  private resolveEnvironment(config: McpServerConfig): {
    env: Record<string, string>;
    missingRequired: string[];
  } {
    const env: Record<string, string> = {};

    if (config.envFromHost) {
      for (const [targetKey, candidates] of Object.entries(config.envFromHost)) {
        const hostValue = candidates
          .map((candidate) => process.env[candidate])
          .find((value): value is string => typeof value === "string" && value.length > 0);
        if (hostValue) {
          env[targetKey] = hostValue;
        }
      }
    }

    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        env[key] = this.resolveTemplate(value);
      }
    }

    const missingRequired = config.requiredEnv.filter((key) => {
      const value = env[key];
      return typeof value !== "string" || value.length === 0;
    });

    return { env, missingRequired };
  }

  private resolveWorkingDirectory(cwd?: string): string | undefined {
    if (!cwd) {
      return undefined;
    }

    const resolved = this.resolveTemplate(cwd);
    return isAbsolute(resolved) ? resolved : resolve(process.cwd(), resolved);
  }

  private resolveTemplate(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_match, token: string) => {
      if (token === "WORKSPACE_ROOT" || token === "PWD") {
        return process.cwd();
      }

      if (token === "USER_HOME") {
        return this.getUserHome();
      }

      const envValue = process.env[token];
      return typeof envValue === "string" ? envValue : "";
    });
  }

  private getUserHome(): string {
    const candidates = [
      process.env.USERPROFILE,
      process.env.HOME,
      process.env.HOMEDRIVE && process.env.HOMEPATH
        ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`
        : undefined,
    ];

    const home = candidates.find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    return home ?? process.cwd();
  }
}

export const mcpProcessManager = new McpProcessManager();

