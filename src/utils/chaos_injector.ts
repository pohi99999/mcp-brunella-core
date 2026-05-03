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
      probability: parseFloat(process.env.CHAOS_PROBABILITY || "0.1"),
      types: (process.env.CHAOS_TYPES || "timeout,rate_limit,corruption").split(",") as any,
      maxDelayMs: parseInt(process.env.CHAOS_MAX_DELAY || "5000"),
      ...config,
    };
  }

  public shouldInject(): boolean {
    return this.config.enabled && Math.random() < this.config.probability;
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

  private corruptData(data: any): any {
    try {
      if (typeof data === "string") {
        return data.split("").reverse().join("");
      }
      if (typeof data === "object" && data !== null) {
        const keys = Object.keys(data);
        if (keys.length > 0) {
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          // Modifikáció: vagy töröljük, vagy felülírjuk véletlen értékkel
          if (Math.random() > 0.5) {
            delete data[randomKey];
          } else {
            data[randomKey] = "CORRUPTED_BY_BRUNELLA_CHAOS";
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

export const globalChaosInjector = new ChaosInjector();
