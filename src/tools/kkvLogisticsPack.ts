import {
  buildKkvPackResponse,
  buildKkvPackSnapshot,
  renderKkvPackBriefMarkdown,
  renderKkvPackMarkdown,
  type KkvPackResponse,
  type KkvPackSnapshot,
} from "./kkvPack.js";

export const logisticsPackId = "logistics-core" as const;

export function buildLogisticsPackSnapshot(): KkvPackSnapshot {
  return buildKkvPackSnapshot({ packId: logisticsPackId });
}

export function buildLogisticsPackResponse(): KkvPackResponse {
  return buildKkvPackResponse({ packId: logisticsPackId });
}

export function renderLogisticsPackMarkdown(): string {
  return renderKkvPackMarkdown(buildLogisticsPackSnapshot());
}

export function renderLogisticsPackBriefMarkdown(): string {
  return renderKkvPackBriefMarkdown(buildLogisticsPackSnapshot().selectedPack);
}
