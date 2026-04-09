import {
  buildKkvPackResponse,
  buildKkvPackSnapshot,
  renderKkvPackBriefMarkdown,
  renderKkvPackMarkdown,
  type KkvPackResponse,
  type KkvPackSnapshot,
} from "./kkvPack.js";

export const inventoryPackId = "inventory-core" as const;

export function buildInventoryPackSnapshot(): KkvPackSnapshot {
  return buildKkvPackSnapshot({ packId: inventoryPackId });
}

export function buildInventoryPackResponse(): KkvPackResponse {
  return buildKkvPackResponse({ packId: inventoryPackId });
}

export function renderInventoryPackMarkdown(): string {
  return renderKkvPackMarkdown(buildInventoryPackSnapshot());
}

export function renderInventoryPackBriefMarkdown(): string {
  return renderKkvPackBriefMarkdown(buildInventoryPackSnapshot().selectedPack);
}
