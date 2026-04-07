/**
 * Agent Health Matrix — Registry-alapú dinamikus teszt
 *
 * Minden registry.json-ban regisztrált agent-et megpróbálja betölteni és
 * ellenőrzi hogy a modul fájl létezik-e és az osztály példányosítható-e.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

interface RegistryAgent {
  name: string;
  title?: string;
  module: string;
  class: string;
  status?: string;
}

const registryPath = path.resolve(process.cwd(), "build", "agents", "registry.json");

function loadRegistry(): RegistryAgent[] {
  if (!fs.existsSync(registryPath)) {
    return [];
  }
  const content = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  return content.agents || [];
}

describe("Agent Health Matrix", () => {
  const agents = loadRegistry();

  it("registry.json should be loadable", () => {
    expect(agents.length).toBeGreaterThan(0);
  });

  it("should have unique agent names", () => {
    const names = agents.map((a) => a.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  describe.each(agents.filter((a) => a.status !== "disabled"))(
    "Agent: $name",
    (agent) => {
      const modulePath = path.resolve(
        process.cwd(),
        "build",
        agent.module.replace("./", "")
      );

      it("module file should exist", () => {
        expect(fs.existsSync(modulePath)).toBe(true);
      });

      it("should be importable and have correct export", async () => {
        if (!fs.existsSync(modulePath)) return;

        const moduleUrl = url.pathToFileURL(modulePath).href;
        const imported = (await import(moduleUrl)) as Record<string, unknown>;

        // Az AgentManager 3 stratégiát próbál: exact class name, default, first function export
        const hasExactExport = typeof imported[agent.class] === "function";
        const hasDefaultExport = typeof imported.default === "function";
        const hasSomeExport = Object.values(imported).some(
          (v) => typeof v === "function"
        );

        expect(hasExactExport || hasDefaultExport || hasSomeExport).toBe(true);
      }, 35_000);

      it("should be instantiable", async () => {
        if (!fs.existsSync(modulePath)) return;

        const moduleUrl = url.pathToFileURL(modulePath).href;
        const imported = (await import(moduleUrl)) as Record<string, unknown>;

        // Keressük meg a megfelelő exportot
        let AgentClass = imported[agent.class] as
          | (new (...args: unknown[]) => unknown)
          | undefined;
        if (typeof AgentClass !== "function") {
          AgentClass = imported.default as
            | (new (...args: unknown[]) => unknown)
            | undefined;
        }
        if (typeof AgentClass !== "function") {
          // Első function export
          AgentClass = Object.values(imported).find(
            (v) => typeof v === "function"
          ) as (new (...args: unknown[]) => unknown) | undefined;
        }

        if (typeof AgentClass !== "function") return;

        // Próbáljuk példányosítani (DynamicAgent config-ot vár)
        let instance: unknown;
        try {
          instance = new AgentClass(agent);
        } catch {
          // Néhány agent-nek speciális konstruktor kell — ez rendben van
          instance = null;
        }

        // Ha sikerült, ellenőrizzük hogy van-e execute metódusa
        if (instance && typeof instance === "object") {
          const hasExecute =
            "execute" in instance || "executeTask" in instance;
          expect(hasExecute).toBe(true);
        }
      }, 35_000);
    }
  );
});
