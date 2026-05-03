import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeEphemeralAgent } from "../core/ephemeralAgentExecutor.js";
import { ephemeralAgentManager } from "../core/ephemeralAgentManager.js";
import { logInfo } from "../utils/logger.js";

export function registerEphemeralAgentTools(server: McpServer): void {
  server.tool(
    "spawn_ephemeral_agent",
    "Létrehoz és végrehajt egy egyszeri, eldobható ügynököt meghatározott feladat elvégzéséhez. " +
    "A spawn_ephemeral_agent automatikusan kezeli az ügynök teljes életciklusát: " +
    "létrehozás → végrehajtás → megszüntetés. " +
    "Akkor használd, ha egy speciális részfeladathoz nincs megfelelő beépített ügynök.",
    {
      purpose: z.string().describe("Az ügynök feladata — rövid, egyértelmű leírás (pl. 'Keress hibákat a server.ts-ben')"),
      task: z.string().describe("A konkrét végrehajtandó utasítás"),
      systemPrompt: z.string().optional().describe("Opcionális egyedi rendszerprompt az ügynöknek"),
      name: z.string().optional().describe("Megjelenítési név az ügynöknek (opcionális)"),
      allowedTools: z.array(z.string()).optional().describe("Engedélyezett eszközök listája (opcionális, alapértelmezett: ['read_file', 'web_search'])"),
      tokenBudget: z.number().optional().describe("Token limit (opcionális, alapértelmezett: 4096)"),
      parentAgentName: z.string().optional().describe("Hívó ügynök neve (opcionális, alapértelmezett: 'orchestrator')"),
    },
    async (args) => {
      const {
        purpose,
        task,
        systemPrompt,
        name,
        allowedTools = ["read_file", "web_search"],
        tokenBudget = 4096,
        parentAgentName = "orchestrator",
      } = args;

      logInfo("EphemeralMCPTool", `spawn_ephemeral_agent: ${purpose.slice(0, 60)}`);

      try {
        const result = await executeEphemeralAgent({
          spec: {
            parentAgentName,
            purpose,
            allowedTools,
            tokenBudget,
            systemPrompt,
            name,
          },
          task,
        });

        const summary = result.success
          ? `✅ Ephemeral ügynök (${result.agentId}) sikeresen végrehajtva.\nTokenek: ${result.tokensUsed ?? 'n/a'}\n\nEredmény:\n${JSON.stringify(result.data, null, 2)}`
          : `❌ Ephemeral ügynök (${result.agentId}) hiba: ${result.error}`;

        return {
          content: [{ type: "text" as const, text: summary }],
        };
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `❌ Hiba az ephemeral ügynök indítasakor: ${errMsg}` }],
        };
      }
    },
  );

  server.tool(
    "list_ephemeral_agents",
    "Listázza az összes aktív és nemrég befejezett ephemeral ügynököt státuszukkal együtt.",
    {},
    async () => {
      const agents = ephemeralAgentManager.listAgents();
      const text = agents.length === 0
        ? "Nincsenek aktív ephemeral ügynökök."
        : agents.map(a =>
            `[${a.id}] ${a.spec.purpose.slice(0, 60)} — állapot: ${a.state} | tokenek: ${a.tokenUsed}/${a.spec.tokenBudget ?? '∞'}`
          ).join("\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
