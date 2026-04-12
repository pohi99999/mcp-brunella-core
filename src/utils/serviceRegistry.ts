// FILE: src/utils/serviceRegistry.ts
// PURPOSE: Central registry for shared service instances — implements the
//          ServiceRegistry pattern for route-layer dependency injection.
//          Allows Express routes to obtain typed service references without
//          relying on module-level mutable singletons.

import { defaultDatabaseManager, type DatabaseManager } from './databaseManager.js';
import { defaultRagEngine, type HybridMemory } from './rag.js';
import { logInfo } from './logger.js';

const COMPONENT = 'ServiceRegistry';

/**
 * Holds all registered service instances in a type-safe map.
 * Extend this interface when new injectable services are added.
 */
export interface Services {
  /** Primary SQLite database manager (better-sqlite3 wrapper). */
  db: DatabaseManager;
  /** Hybrid LanceDB vector-memory engine. */
  ragEngine: HybridMemory;
}

/**
 * Central registry for shared, injectable service instances.
 *
 * Provides a singleton access point so Express route factories can
 * receive references without importing module-level globals directly.
 *
 * Usage:
 * ```typescript
 * import { getServiceRegistry } from '../utils/serviceRegistry.js';
 *
 * export function createMyRoutes() {
 *   const { db } = getServiceRegistry().getAll();
 *   // ... use db
 * }
 * ```
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry | null = null;

  private services: Services;

  private constructor() {
    this.services = {
      db: defaultDatabaseManager,
      ragEngine: defaultRagEngine,
    };
  }

  /**
   * Returns the process-wide ServiceRegistry singleton.
   * Creates a new instance on first call, pre-registered with default services.
   */
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
      logInfo(COMPONENT, 'ServiceRegistry singleton created with default services');
    }
    return ServiceRegistry.instance;
  }

  /**
   * Returns the full services map.
   * Prefer destructuring specific services for clarity:
   * ```typescript
   * const { db, ragEngine } = registry.getAll();
   * ```
   */
  getAll(): Readonly<Services> {
    return this.services;
  }

  /**
   * Retrieves a single registered service by key.
   * @param key - Service key from the {@link Services} interface
   * @throws Error if the key is not registered
   */
  get<K extends keyof Services>(key: K): Services[K] {
    return this.services[key];
  }

  /**
   * Replaces a service registration. Useful for testing (mock injection)
   * or for providing an alternate implementation at startup.
   * @param key - Service key to override
   * @param service - New service instance
   */
  register<K extends keyof Services>(key: K, service: Services[K]): void {
    this.services[key] = service;
    logInfo(COMPONENT, `Service registered: ${String(key)}`);
  }

  /**
   * Disposes all registered services and clears the singleton.
   * Should be called during graceful shutdown.
   */
  async dispose(): Promise<void> {
    logInfo(COMPONENT, 'Disposing all registered services');
    try {
      await this.services.ragEngine.dispose();
    } catch (err: unknown) {
      // Non-fatal: log and continue disposing remaining services
      const msg = err instanceof Error ? err.message : String(err);
      logInfo(COMPONENT, `ragEngine dispose warning: ${msg}`);
    }
    try {
      this.services.db.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logInfo(COMPONENT, `db dispose warning: ${msg}`);
    }
    ServiceRegistry.instance = null;
  }

  /** @internal Reset for unit testing — do not call in production code. */
  static _resetForTesting(): void {
    ServiceRegistry.instance = null;
  }
}

/**
 * Convenience accessor — returns the process-wide {@link ServiceRegistry} singleton.
 *
 * @example
 * ```typescript
 * const registry = getServiceRegistry();
 * const db = registry.get('db');
 * ```
 */
export function getServiceRegistry(): ServiceRegistry {
  return ServiceRegistry.getInstance();
}
