import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DynamicAgent } from "../src/agents/DynamicAgent.js";

describe("VIKTORIAVARGA brand voice agent", () => {
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

    const entry = registry.agents.find((agent) => agent.name === "viktoria-brand-voice");
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      name: "viktoria-brand-voice",
      class: "DynamicAgent",
      module: "./agents/DynamicAgent.js",
      status: "active",
    });
    expect(entry?.config?.tomlPath).toBe("myai/agents/ViktoriaBrandVoice.toml");

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

    expect(agent.name).toBe("viktoria-brand-voice");
    expect(typedAgent.role).toBe("VIKTORIAVARGA Márka AI");
    expect(typedAgent.description).toContain("Prémium fashion brand voice foundation");
    expect(typedAgent.systemPrompt).toContain("HU + EN parallel");
    expect(typedAgent.systemPrompt).toContain("olcsó / akció / kedvezmény");
    expect(typedAgent.systemPrompt).toContain("never generic");
    expect(typedAgent.queryTemplate).toContain("${contentType}");
    expect(typedAgent.queryTemplate).toContain("${mood}");
    expect(typedAgent.capabilities).toEqual(
      expect.arrayContaining([
        "brand-voice",
        "caption-writing",
        "email-drafting",
        "campaign-copy",
        "product-descriptions",
      ]),
    );
  });
});
