import type { ChatMessage } from "./types";

export const MAX_CONTEXT_MESSAGES = 10;

const HUNGARIAN_SYSTEM_PREAMBLE =
  "Te Brunella vagy, az MCP Brunella Core rendszer AI asszisztense. Válaszolj természetesen, magyarul, professzionálisan és segítőkészen.";

export function buildConversationPrompt(
  history: ChatMessage[],
  userInput: string,
): string {
  const recent = history.slice(-MAX_CONTEXT_MESSAGES);

  if (recent.length === 0) {
    return [
      HUNGARIAN_SYSTEM_PREAMBLE,
      "",
      `Felhasználó: ${userInput}`,
    ].join("\n");
  }

  const rendered = recent
    .map(
      (m) =>
        `${m.role === "user" ? "Felhasználó" : "Asszisztens"}: ${m.content}`,
    )
    .join("\n");

  return [
    HUNGARIAN_SYSTEM_PREAMBLE,
    "",
    "Korábbi beszélgetés (rövid kontextus):",
    rendered,
    "",
    `Új felhasználói üzenet: ${userInput}`,
    "Válaszolj természetesen, magyarul, a kontextust figyelembe véve.",
  ].join("\n");
}
