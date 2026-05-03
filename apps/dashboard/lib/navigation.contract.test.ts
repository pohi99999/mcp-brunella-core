import { beforeEach, describe, expect, it } from "vitest";
import { V1_ROUTE_MOUNTS, API_ROUTE_BASES } from "../../mcp-core/server/routes/routeManifest.js";
import { initializeNavigation, navigationRegistry } from "./navigation.js";
import { CONDUCTOR_MONITOR_NAV, NAVIGATION_API_CONTRACTS, PROJECT_MGMT_NAV_GROUP } from "./navigationContract.js";

function normalizeApiPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? path;
  const base = API_ROUTE_BASES.find((candidate) => withoutQuery === candidate || withoutQuery.startsWith(`${candidate}/`));
  if (!base) return withoutQuery;
  const mountPath = withoutQuery.slice(base.length) || "/";
  return mountPath.endsWith("/") && mountPath.length > 1 ? mountPath.slice(0, -1) : mountPath;
}

function matchesRouteMount(path: string): boolean {
  const normalized = normalizeApiPath(path);
  const matchingMounts = V1_ROUTE_MOUNTS
    .filter((mount) => normalized === mount || normalized.startsWith(`${mount}/`))
    .sort((left, right) => right.length - left.length);
  return matchingMounts.length > 0;
}

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

  it("keeps navigation groups unique and backed by registered items", () => {
    const groups = navigationRegistry.getGroups();
    const itemIds = new Set(navigationRegistry.getAllItems().map((item) => item.id));
    const groupTitles = groups.map((group) => group.title);

    expect(new Set(groupTitles).size).toBe(groupTitles.length);
    for (const group of groups) {
      for (const itemId of group.items) {
        expect(itemIds.has(itemId), `${group.title} references missing nav item ${itemId}`).toBe(true);
      }
    }
  });

  it("keeps critical dashboard panels mapped to registered backend routes", () => {
    const itemIds = new Set(navigationRegistry.getAllItems().map((item) => item.id));

    for (const contract of NAVIGATION_API_CONTRACTS) {
      expect(itemIds.has(contract.navId), `Missing nav item for ${contract.navId}`).toBe(true);
      for (const apiPath of contract.apiPaths) {
        expect(matchesRouteMount(apiPath), `${contract.navId} uses unregistered API path ${apiPath}`).toBe(true);
      }
    }
  });
});
