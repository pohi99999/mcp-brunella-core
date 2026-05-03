import { logWarn, logInfo } from "./logger.js";

export interface ChaosConfig {
  enabled: boolean;
  probability: number; // 0.0 - 1.0
  types: ("timeout" | "rate_limit" | "corruption")[];
  maxDelayMs: number;
}

export class ChaosInjector {
  private config: ChaosConfig;

  constructor(config?: Partial<ChaosConfig>) {
    this.config = {
      enabled: process.env.CHAOS_MODE === "true",
      probability: clampProbability(parseFloat(process.env.CHAOS_PROBABILITY || "0.1")),
      types: normalizeChaosTypes((process.env.CHAOS_TYPES || "timeout,rate_limit,corruption").split(",")),
      maxDelayMs: clampDelay(parseInt(process.env.CHAOS_MAX_DELAY || "5000", 10)),
      ...config,
    };
    this.config = this.updateConfig(this.config);
  }

  public shouldInject(): boolean {
    return this.config.enabled && Math.random() < this.config.probability;
  }

  public getConfig(): ChaosConfig {
    return {
      enabled: this.config.enabled,
      probability: this.config.probability,
      types: [...this.config.types],
      maxDelayMs: this.config.maxDelayMs,
    };
  }

  public updateConfig(config: Partial<ChaosConfig>): ChaosConfig {
    const nextConfig = {
      ...this.config,
      ...config,
      probability: clampProbability(config.probability ?? this.config.probability),
      maxDelayMs: clampDelay(config.maxDelayMs ?? this.config.maxDelayMs),
      types: normalizeChaosTypes(config.types ?? this.config.types),
    };
    this.config = nextConfig;
    return this.getConfig();
  }

  public async injectChaos<T>(toolName: string, handler: () => Promise<T>): Promise<T> {
    if (!this.shouldInject()) {
      return handler();
    }

    const type = this.config.types[Math.floor(Math.random() * this.config.types.length)];
    logWarn("ChaosInjector", `Injektálás indítva: [${type}] az eszközön: ${toolName}`);

    switch (type) {
      case "timeout": {
        const delay = Math.floor(Math.random() * this.config.maxDelayMs);
        logInfo("ChaosInjector", `Késleltetés szimulálása: ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return handler();
      }

      case "rate_limit":
        logWarn("ChaosInjector", `Rate Limit (429) szimulálása.`);
        throw new Error(`Tool ${toolName} failed with status 429: Too Many Requests (Chaos Mode)`);

      case "corruption": {
        const result = await handler();
        logWarn("ChaosInjector", `Adatkorrupció szimulálása.`);
        return this.corruptData(result);
      }

      default:
        return handler();
    }
  }

  private corruptData<T>(data: T): T {
    try {
      if (typeof data === "string") {
        return data.split("").reverse().join("") as T;
      }
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        const keys = Object.keys(record);
        if (keys.length > 0) {
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          // Modifikáció: vagy töröljük, vagy felülírjuk véletlen értékkel
          if (Math.random() > 0.5) {
            delete record[randomKey];
          } else {
            record[randomKey] = "CORRUPTED_BY_BRUNELLA_CHAOS";
          }
        }
      }
      return data;
    } catch (e) {
      logWarn("ChaosInjector", "Hiba az adatkorrupció során, az eredeti adatot küldöm vissza.");
      return data;
    }
  }
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.1;
  return Math.min(1, Math.max(0, value));
}

function clampDelay(value: number): number {
  if (!Number.isFinite(value)) return 5000;
  return Math.max(0, Math.floor(value));
}

function normalizeChaosTypes(types: readonly string[]): ChaosConfig["types"] {
  const allowed = new Set<ChaosConfig["types"][number]>(["timeout", "rate_limit", "corruption"]);
  const normalized = types.filter((type): type is ChaosConfig["types"][number] =>
    allowed.has(type as ChaosConfig["types"][number]),
  );
  return normalized.length > 0 ? normalized : ["timeout"];
}

export const globalChaosInjector = new ChaosInjector();
