import { describe, expect, it } from "vitest";
import { CONDUCTOR_MONITOR_NAV, PROJECT_MGMT_NAV_GROUP } from "./navigationContract.js";

describe("navigation registry contract", () => {
  it("keeps conductor monitor visible in the project management group", () => {
    expect(PROJECT_MGMT_NAV_GROUP.title).toBe("Project Mgmt");
    expect(PROJECT_MGMT_NAV_GROUP.items).toContain(CONDUCTOR_MONITOR_NAV.id);
    expect(PROJECT_MGMT_NAV_GROUP.items.indexOf(CONDUCTOR_MONITOR_NAV.id)).toBeLessThan(
      PROJECT_MGMT_NAV_GROUP.items.indexOf("tracks") ?? Number.POSITIVE_INFINITY,
    );
    expect(CONDUCTOR_MONITOR_NAV.label).toBe("Trackek állapota");
  });
});