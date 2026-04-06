import { describe, expect, it, vi } from "vitest";

describe("navigation registry contract", () => {
  it("keeps conductor monitor visible in the project management group", async () => {
    vi.resetModules();

    const navigationModule = await import("./navigation");

    navigationModule.initializeNavigation();

    const projectGroup = navigationModule.navigationRegistry
      .getGroups()
      .find((group) => group.title === "Project Mgmt");

    expect(projectGroup).toBeDefined();
    expect(projectGroup?.items).toContain("conductor-monitor");
    expect(projectGroup?.items.indexOf("conductor-monitor")).toBeLessThan(
      projectGroup?.items.indexOf("tracks") ?? Number.POSITIVE_INFINITY,
    );

    const conductorItem = navigationModule.navigationRegistry.getItem("conductor-monitor");
    expect(conductorItem?.label).toBe("Trackek állapota");
  }, 20_000);
});