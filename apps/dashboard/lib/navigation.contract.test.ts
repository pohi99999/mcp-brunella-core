import { beforeEach, describe, expect, it } from "vitest";
import { initializeNavigation, navigationRegistry } from "./navigation.js";
import { CONDUCTOR_MONITOR_NAV, PROJECT_MGMT_NAV_GROUP } from "./navigationContract.js";

describe("navigation registry contract", () => {
  beforeEach(() => {
    initializeNavigation();
  });

  it("keeps conductor monitor visible in the project management group", () => {
    const groups = navigationRegistry.getGroups();
    const items = navigationRegistry.getAllItems();
    const projectMgmt = groups.find((group) => group.title === PROJECT_MGMT_NAV_GROUP.title);
    const monitorItem = items.find((item) => item.id === CONDUCTOR_MONITOR_NAV.id);

    expect(PROJECT_MGMT_NAV_GROUP.title).toBe("Project Mgmt");
    expect(projectMgmt).toBeDefined();
    expect(projectMgmt?.items).toContain(CONDUCTOR_MONITOR_NAV.id);
    expect(projectMgmt?.items.indexOf(CONDUCTOR_MONITOR_NAV.id) ?? Number.POSITIVE_INFINITY).toBeLessThan(
      projectMgmt?.items.indexOf("tracks") ?? Number.POSITIVE_INFINITY,
    );
    expect(monitorItem?.label).toBe("Trackek állapota");
  });
});
