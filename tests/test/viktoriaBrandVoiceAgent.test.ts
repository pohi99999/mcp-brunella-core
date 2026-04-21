import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DynamicAgent } from "../src/agents/DynamicAgent.js";

type RegistryAgent = {
  name: string;
  class?: string;
  module?: string;
  status?: string;
  config?: { tomlPath?: string };
};

type Fixture = {
  name: string;
  tomlPath: string;
  displayName: string;
  descriptionIncludes: string[];
  systemPromptIncludes: string[];
  queryIncludes: string[];
  capabilities: string[];
};

const fixtures: Fixture[] = [
  {
    name: "social_concierge",
    tomlPath: "myai/agents/SocialConciergeAgent.toml",
    displayName: "VIKTORIAVARGA Social Concierge",
    descriptionIncludes: ["post, reply és DM draftok"],
    systemPromptIncludes: [
      "HU + EN parallel",
      "customer-service safe",
      "clarifying kérdést",
      "A válasz soha ne legyen generikus",
    ],
    queryIncludes: ["${brief}", "${intent}", "${length}"],
    capabilities: [
      "social_post_drafting",
      "social_reply_drafting",
      "dm_drafting",
      "community_response",
      "clarification_fallback",
    ],
  },
  {
    name: "shopping_assistant",
    tomlPath: "myai/agents/ShoppingAssistantAgent.toml",
    displayName: "VIKTORIAVARGA Shopping Assistant",
    descriptionIncludes: ["product discovery", "order és support draftok"],
    systemPromptIncludes: [
      "HU + EN parallel",
      "support-safe",
      "human handoff",
      "A válasz soha ne legyen generikus",
    ],
    queryIncludes: ["${brief}", "${intent}", "${product}", "${status}"],
    capabilities: [
      "shopping_guidance",
      "availability_reply",
      "order_support",
      "customer_service",
      "support_escalation",
    ],
  },
];

function loadRegistry(): { agents: RegistryAgent[] } {
  const registryPath = path.resolve(process.cwd(), "src", "agents", "registry.json");
  return JSON.parse(fs.readFileSync(registryPath, "utf8")) as { agents: RegistryAgent[] };
}

describe("VIKTORIAVARGA support agents", () => {
  const registry = loadRegistry();

  it("keeps the registry entries visible to CLI and dashboard loading", () => {
    for (const fixture of fixtures) {
      expect(registry.agents.some((agent) => agent.name === fixture.name)).toBe(true);
    }
  });

  describe.each(fixtures)("$name", (fixture) => {
    it("loads the registry entry and TOML-backed DynamicAgent config", () => {
      const entry = registry.agents.find((agent) => agent.name === fixture.name);
      expect(entry).toBeDefined();
      expect(entry).toMatchObject({
        name: fixture.name,
        class: "DynamicAgent",
        module: "./agents/DynamicAgent.js",
        status: "active",
      });
      expect(entry?.config?.tomlPath).toBe(fixture.tomlPath);

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

      expect(agent.name).toBe(fixture.name);
      expect(typedAgent.role).toBe(fixture.displayName);
      fixture.descriptionIncludes.forEach((text) => {
        expect(typedAgent.description).toContain(text);
      });
      fixture.systemPromptIncludes.forEach((text) => {
        expect(typedAgent.systemPrompt).toContain(text);
      });
      fixture.queryIncludes.forEach((text) => {
        expect(typedAgent.queryTemplate).toContain(text);
      });
      expect(typedAgent.capabilities).toEqual(expect.arrayContaining(fixture.capabilities));
    });
  });
});
