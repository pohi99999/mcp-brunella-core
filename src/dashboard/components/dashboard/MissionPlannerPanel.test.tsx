import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MissionPlannerPanel } from "./MissionPlannerPanel";
import * as api from "@/lib/apiService";
import { buildDevExPlannerSnapshot, renderDevExPlannerMarkdown } from "../../../tools/missionPlanner.js";

vi.mock("@/lib/apiService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apiService")>();
  return {
    ...actual,
    getDevExPlannerSnapshot: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getDevExPlannerSnapshot: ReturnType<typeof vi.fn>;
};

function prepareResponse(templateId: string, surface: "api" | "docs" | "dashboard" = "dashboard", tier?: "recommended" | "full") {
  const snapshot = buildDevExPlannerSnapshot({
    templateId,
    surface,
    tier,
  });

  mockedApi.getDevExPlannerSnapshot.mockResolvedValue({
    success: true,
    snapshot,
    markdown: renderDevExPlannerMarkdown(snapshot),
  });

  return snapshot;
}

describe("MissionPlannerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the selected mission details and template library", async () => {
    prepareResponse("dashboard-panel", "dashboard", "full");

    render(<MissionPlannerPanel />);

    expect(await screen.findByText("Mission Planner")).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard Panel Mission").length).toBeGreaterThan(1);
    expect(screen.getByText("Register the panel in the navigation registry.")).toBeInTheDocument();
    expect(screen.getByText("Template library")).toBeInTheDocument();
    expect(mockedApi.getDevExPlannerSnapshot).toHaveBeenCalledWith(undefined, undefined);
  });

  it("surfaces warnings and recommendations from the snapshot", async () => {
    prepareResponse("api-route", "docs", "recommended");

    render(<MissionPlannerPanel />);

    expect(await screen.findByText("Mission Planner")).toBeInTheDocument();
    expect(screen.getByText(/overrides the template's default/i)).toBeInTheDocument();
    expect(screen.getAllByText("Docs / config").length).toBeGreaterThan(0);
  });
});
