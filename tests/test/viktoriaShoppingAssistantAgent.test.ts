import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DynamicAgent } from "@packages/agents/DynamicAgent.js";

describe("VIKTORIAVARGA shopping assistant", () => {
  it("loads the registry entry and TOML-backed DynamicAgent config", () => {
    const registryPath = path.resolve(process.cwd(), "src", "agents", "registry.json");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8")) as {
      agents: Array<{
        name: string;
        class?: string;
        module?: string;
        status?: string;
        config?: { tomlPath?: string };
      }>;
    };

    const entry = registry.agents.find((agent) => agent.name === "shopping_assistant");
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      name: "shopping_assistant",
      class: "DynamicAgent",
      module: "./agents/DynamicAgent.js",
      status: "active",
    });
    expect(entry?.config?.tomlPath).toBe("packages/myai/agents/ShoppingAssistantAgent.toml");

    const tomlPath = path.resolve(process.cwd(), entry!.config!.tomlPath!);
    expect(fs.existsSync(tomlPath)).toBe(true);

    const agent = new DynamicAgent({
      name: entry!.name,
      tomlPath,
    });

    const typedAgent = agent as unknown as {
      role: string;
      description: string;
      capabilities: string[];
      systemPrompt: string;
      queryTemplate: string;
    };

    expect(agent.name).toBe("shopping_assistant");
    expect(typedAgent.role).toBe("VIKTORIAVARGA Shopping Assistant");
    expect(typedAgent.description).toContain("product discovery");
    expect(typedAgent.description).toContain("order és support draftok");
    expect(typedAgent.systemPrompt).toContain("HU + EN parallel");
    expect(typedAgent.systemPrompt).toContain("support-safe");
    expect(typedAgent.systemPrompt).toContain("A válasz soha ne legyen generikus");
    expect(typedAgent.queryTemplate).toContain("${brief}");
    expect(typedAgent.queryTemplate).toContain("${product}");
    expect(typedAgent.queryTemplate).toContain("${status}");
    expect(typedAgent.capabilities).toEqual(
      expect.arrayContaining([
        "shopping_guidance",
        "availability_reply",
        "order_support",
        "customer_service",
        "support_escalation",
      ]),
    );
  });
});
