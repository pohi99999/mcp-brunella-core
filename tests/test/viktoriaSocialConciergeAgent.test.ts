import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DynamicAgent } from "@packages/agents/DynamicAgent.js";

describe("VIKTORIAVARGA social concierge", () => {
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

    const entry = registry.agents.find((agent) => agent.name === "social_concierge");
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      name: "social_concierge",
      class: "DynamicAgent",
      module: "./agents/DynamicAgent.js",
      status: "active",
    });
    expect(entry?.config?.tomlPath).toBe("packages/myai/agents/SocialConciergeAgent.toml");

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

    expect(agent.name).toBe("social_concierge");
    expect(typedAgent.role).toBe("VIKTORIAVARGA Social Concierge");
    expect(typedAgent.description).toContain("post, reply és DM draftok");
    expect(typedAgent.systemPrompt).toContain("HU + EN parallel");
    expect(typedAgent.systemPrompt).toContain("customer-service safe");
    expect(typedAgent.systemPrompt).toContain("A válasz soha ne legyen generikus");
    expect(typedAgent.queryTemplate).toContain("${brief}");
    expect(typedAgent.queryTemplate).toContain("${intent}");
    expect(typedAgent.capabilities).toEqual(
      expect.arrayContaining([
        "social_post_drafting",
        "social_reply_drafting",
        "dm_drafting",
        "community_response",
        "clarification_fallback",
      ]),
    );
  });
});
