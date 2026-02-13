import type { ChatMessage } from "./types";

export const MAX_CONTEXT_MESSAGES = 10;

export function buildConversationPrompt(
  history: ChatMessage[],
  userInput: string,
): string {
  const recent = history.slice(-MAX_CONTEXT_MESSAGES);
  if (recent.length === 0) return userInput;

  const rendered = recent
    .map(
      (m) =>
        `${m.role === "user" ? "Felhasználó" : "Asszisztens"}: ${m.content}`,
    )
    .join("\n");

  return [
    "Korábbi beszélgetés (rövid kontextus):",
    rendered,
    "",
    `Új felhasználói üzenet: ${userInput}`,
    "Válaszolj természetesen, magyarul, a kontextust figyelembe véve.",
  ].join("\n");
}
