import { describe, expect, it } from "vitest";

import {
  buildKkvPackResponse,
  buildKkvPackSnapshot,
  renderKkvPackBriefMarkdown,
  renderKkvPackMarkdown,
} from "../src/tools/kkvPack.js";
import { buildFinancePackSnapshot } from "../src/tools/kkvFinancePack.js";
import { buildInventoryPackSnapshot } from "../src/tools/kkvInventoryPack.js";
import { buildLogisticsPackSnapshot } from "../src/tools/kkvLogisticsPack.js";

describe("kkvPack", () => {
  it("builds a healthy default snapshot with finance selected", () => {
    const snapshot = buildKkvPackSnapshot();

    expect(snapshot.selectedPackId).toBe("finance-core");
    expect(snapshot.summary.totalPacks).toBe(3);
    expect(snapshot.summary.readyPacks).toBe(2);
    expect(snapshot.summary.pilotPacks).toBe(1);
    expect(snapshot.summary.status).toBe("healthy");
    expect(snapshot.warnings.some((warning) => warning.includes("Pilot packs"))).toBe(true);
  });

  it("keeps logistics in pilot mode and warns about the bounded brief", () => {
    const snapshot = buildKkvPackSnapshot({ packId: "logistics-core" });

    expect(snapshot.selectedPackId).toBe("logistics-core");
    expect(snapshot.selectedPack.status).toBe("pilot");
    expect(snapshot.warnings.some((warning) => warning.includes("Selected pack logistics-core"))).toBe(true);
    expect(snapshot.recommendations.some((recommendation) => recommendation.id === "promote-logistics-from-pilot")).toBe(true);
  });

  it("rejects unknown pack ids", () => {
    expect(() => buildKkvPackSnapshot({ packId: "missing-pack" })).toThrow("Unknown KKV pack: missing-pack");
  });

  it("renders the combined cockpit markdown", () => {
    const snapshot = buildKkvPackSnapshot({ packId: "inventory-core" });
    const markdown = renderKkvPackMarkdown(snapshot);

    expect(markdown).toContain("# KKV Pack Productization & Cockpit Definition");
    expect(markdown).toContain("Inventory Core Pack");
    expect(markdown).toContain("Pack boundary overview");
    expect(markdown).toContain("Product brief");
  });

  it("renders the selected pack brief and response envelope", () => {
    const response = buildKkvPackResponse({ packId: "finance-core" });

    expect(response.success).toBe(true);
    expect(response.snapshot.selectedPackId).toBe("finance-core");
    expect(response.markdown).toContain("Finance Core Pack");
    expect(response.briefMarkdown).toContain("Guardrail");
    expect(renderKkvPackBriefMarkdown(response.snapshot.selectedPack)).toContain("Pilot criteria");
  });

  it("exports the finance pack wrapper", () => {
    expect(buildFinancePackSnapshot().selectedPackId).toBe("finance-core");
  });

  it("exports the inventory pack wrapper", () => {
    expect(buildInventoryPackSnapshot().selectedPackId).toBe("inventory-core");
  });

  it("exports the logistics pack wrapper", () => {
    expect(buildLogisticsPackSnapshot().selectedPackId).toBe("logistics-core");
  });
});
