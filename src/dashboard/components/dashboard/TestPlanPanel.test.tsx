import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TestPlanPanel } from "./TestPlanPanel";
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

function prepareResponse(templateId: string, surface: "api" | "docs" | "dashboard" = "dashboard", tier?: "minimal" | "recommended" | "full") {
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

describe("TestPlanPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the cadence matrix and the recommended command list", async () => {
    prepareResponse("dashboard-panel", "dashboard", "full");

    render(<TestPlanPanel />);

    expect(await screen.findByText("Test Cadence")).toBeInTheDocument();
    expect(screen.getAllByText("npm run build:ui").length).toBeGreaterThan(0);
    expect(screen.getAllByText("npm run test:ui").length).toBeGreaterThan(0);
    expect(screen.getByText("No warnings.")).toBeInTheDocument();
  });

  it("surfaces cadence warnings and combined recommendations", async () => {
    prepareResponse("dashboard-panel", "dashboard", "recommended");

    render(<TestPlanPanel />);

    expect(await screen.findByText("Test Cadence")).toBeInTheDocument();
    expect(screen.getByText(/Dashboard and mixed work usually need the full cadence\./)).toBeInTheDocument();
    expect(screen.getByText("Carry the cadence rationale into the task note")).toBeInTheDocument();
  });
});
