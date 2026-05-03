/**
 * Copilot CLI Bridge Provider
 *
 * Sends chat messages to the BAS backend which routes them
 * through the Bifrost Gateway "copilot" provider (file-bridge).
 * The Copilot CLI picks up request files, processes them, and writes responses.
 */
import type { ChatProvider, ChatSendInput, ChatSendOutput } from "../types";
import { MasterOrchestratorProvider } from "./masterOrchestratorProvider";

// Egyszerű heurisztika: ha a promptban szerepel "agent", "orchestrate", "swarm", vagy több agent neve, multi-agent orchestration-t indítunk
function needsMultiAgentOrchestration(input: ChatSendInput): boolean {
  const text = input.text.toLowerCase();
  // Egyszerűbb trigger szavak
  if (text.includes("orchestrate") || text.includes("swarm") || text.includes("multi-agent") || text.includes("több ügynök")) return true;
  // Ha felsorolás van, vesszővel elválasztva legalább 2 agent név
  if ((text.match(/agent/gi) || []).length > 1) return true;
  return false;
}

export const copilotProvider: ChatProvider = {
  mode: "copilot",

  async send(input) {
    if (needsMultiAgentOrchestration(input)) {
      // Multi-agent orchestration delegálás a masterOrchestratorProvider-nek
      const master = new MasterOrchestratorProvider();
      return master.send(input);
    }
    // Single-agent (alapértelmezett)
    const response = await fetch("/api/paios/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.text,
        provider: "copilot",
        model: "copilot-cli",
        conversationHistory: input.history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Copilot bridge error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      success?: boolean;
      summary?: string;
      reply?: string;
      error?: string;
    };

    if (data.error || data.success === false) {
      throw new Error(data.error);
    }

    return {
      message: data.summary || data.reply || "No response from Copilot CLI",
      executedBy: "copilot-cli",
    };
  },
};
