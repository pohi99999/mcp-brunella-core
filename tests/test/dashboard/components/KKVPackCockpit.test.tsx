import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KKVPackCockpit } from "@/components/dashboard/KKVPackCockpit";
import * as api from "@/lib/apiService";
import { buildKkvPackResponse } from "../../../src/tools/kkvPack.js";

vi.mock("@/lib/apiService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apiService")>();
  return {
    ...actual,
    getKkvPackSnapshot: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getKkvPackSnapshot: ReturnType<typeof vi.fn>;
};

function prepareResponse(packId?: string) {
  mockedApi.getKkvPackSnapshot.mockImplementation(async (selectedPackId?: string) =>
    buildKkvPackResponse({ packId: selectedPackId ?? packId }),
  );
}

describe("KKVPackCockpit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the selected pack brief and matrix", async () => {
    prepareResponse("finance-core");

    render(<KKVPackCockpit />);

    expect(await screen.findByText("Productization Cockpit")).toBeInTheDocument();
    expect(screen.getByLabelText("Select KKV pack")).toHaveValue("finance-core");
    expect(screen.getByText("Finance pack for month-end control")).toBeInTheDocument();
    expect(mockedApi.getKkvPackSnapshot).toHaveBeenCalledWith("finance-core");
  });

  it("reloads the cockpit when another pack is selected", async () => {
    prepareResponse("finance-core");

    render(<KKVPackCockpit />);

    expect(await screen.findByText("Productization Cockpit")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Select KKV pack"), {
      target: { value: "logistics-core" },
    });

    expect(screen.getByLabelText("Select KKV pack")).toHaveValue("logistics-core");
    expect(await screen.findByText("Logistics pack for dispatch visibility")).toBeInTheDocument();
  });
});
