import {
  buildKkvPackResponse,
  buildKkvPackSnapshot,
  renderKkvPackBriefMarkdown,
  renderKkvPackMarkdown,
  type KkvPackResponse,
  type KkvPackSnapshot,
} from "./kkvPack.js";

export const financePackId = "finance-core" as const;

export function buildFinancePackSnapshot(): KkvPackSnapshot {
  return buildKkvPackSnapshot({ packId: financePackId });
}

export function buildFinancePackResponse(): KkvPackResponse {
  return buildKkvPackResponse({ packId: financePackId });
}

export function renderFinancePackMarkdown(): string {
  return renderKkvPackMarkdown(buildFinancePackSnapshot());
}

export function renderFinancePackBriefMarkdown(): string {
  return renderKkvPackBriefMarkdown(buildFinancePackSnapshot().selectedPack);
}
