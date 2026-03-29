import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HazipenztarWidget } from "@/components/dashboard/HazipenztarWidget";
import * as api from "@/lib/apiService";

vi.mock("@/lib/apiService", () => ({
  createCashEntry: vi.fn(),
  getCashEntries: vi.fn(),
  getCashSummary: vi.fn(),
  updateCashEntry: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  createCashEntry: ReturnType<typeof vi.fn>;
  getCashEntries: ReturnType<typeof vi.fn>;
  getCashSummary: ReturnType<typeof vi.fn>;
  updateCashEntry: ReturnType<typeof vi.fn>;
};

const entriesResponse = {
  success: true,
  entries: [
    {
      id: 1,
      date: "2026-03-29",
      type: "KP_IN" as const,
      amount: 15000,
      description: "Keszpenzes bevetelek",
      source: "manual" as const,
      syncedSheets: false,
      createdAt: "2026-03-29T10:00:00.000Z",
      updatedAt: "2026-03-29T10:00:00.000Z",
    },
    {
      id: 2,
      date: "2026-03-30",
      type: "KP_OUT" as const,
      amount: 2500,
      description: "Irodaszer beszerzes",
      invoiceNumber: "INV-200",
      source: "email" as const,
      syncedSheets: true,
      createdAt: "2026-03-30T10:00:00.000Z",
      updatedAt: "2026-03-30T10:00:00.000Z",
    },
  ],
  total: 2,
  offset: 0,
  limit: 8,
};

const summaryResponse = {
  success: true,
  summary: {
    total: 2,
    income: 15000,
    expense: 2500,
    balance: 12500,
    syncedSheets: 1,
    pendingSheets: 1,
    byType: {
      KP_IN: 1,
      KP_OUT: 1,
    },
  },
  timestamp: "2026-03-30T11:00:00.000Z",
};

describe("HazipenztarWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads cash summary and recent entries", async () => {
    vi.useFakeTimers();
    mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
    mockedApi.getCashSummary.mockResolvedValue(summaryResponse);

    await act(async () => {
      render(<HazipenztarWidget />);
    });

    await screen.findByText("15 000 Ft");
    expect(screen.getByText("Összes")).toBeInTheDocument();
    expect(screen.getByText("Irodaszer beszerzes")).toBeInTheDocument();
    expect(mockedApi.getCashEntries).toHaveBeenCalledTimes(1);
    expect(mockedApi.getCashSummary).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    await waitFor(() => {
      expect(mockedApi.getCashEntries).toHaveBeenCalledTimes(2);
      expect(mockedApi.getCashSummary).toHaveBeenCalledTimes(2);
    });
  });

  it("creates a new cash entry and toggles sync state", async () => {
    mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
    mockedApi.getCashSummary.mockResolvedValue(summaryResponse);
    mockedApi.createCashEntry.mockResolvedValue({
      success: true,
      entry: entriesResponse.entries[0],
    });
    mockedApi.updateCashEntry.mockResolvedValue({
      success: true,
      entry: { ...entriesResponse.entries[0], syncedSheets: true },
    });

    await act(async () => {
      render(<HazipenztarWidget />);
    });

    await screen.findByText("Keszpenzes bevetelek");

    fireEvent.change(screen.getByLabelText("Dátum"), { target: { value: "2026-03-31" } });
    fireEvent.change(screen.getByLabelText("Összeg"), { target: { value: "9900" } });
    fireEvent.change(screen.getByLabelText("Leírás"), { target: { value: "Napi bevetelek" } });
    fireEvent.change(screen.getByLabelText("Számlaszám"), { target: { value: "INV-300" } });

    fireEvent.click(screen.getByRole("button", { name: "KP tétel mentése" }));

    await waitFor(() => {
      expect(mockedApi.createCashEntry).toHaveBeenCalledWith({
        date: "2026-03-31",
        type: "KP_IN",
        amount: 9900,
        description: "Napi bevetelek",
        invoiceNumber: "INV-300",
        source: "manual",
        syncedSheets: false,
      });
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Szinkronált" })[0]);

    await waitFor(() => {
      expect(mockedApi.updateCashEntry).toHaveBeenCalledWith(1, { syncedSheets: true });
    });
  });
});
