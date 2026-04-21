import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HazipenztarWidget } from "@/components/dashboard/HazipenztarWidget";
import * as api from "@/lib/apiService";
import { toast } from "sonner";

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
const mockedToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
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
    mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
    mockedApi.getCashSummary.mockResolvedValue(summaryResponse);

    await act(async () => {
      render(<HazipenztarWidget />);
    });

    // Wait for entry data (avoids locale-specific currency formatting issues)
    await screen.findByText("Irodaszer beszerzes");
    expect(screen.getByText("Összes")).toBeInTheDocument();
    expect(screen.getByText("Keszpenzes bevetelek")).toBeInTheDocument();
    expect(mockedApi.getCashEntries).toHaveBeenCalledTimes(1);
    expect(mockedApi.getCashSummary).toHaveBeenCalledTimes(1);
  });

  it("re-fetches data after 30 second interval", async () => {
    // Fake timers must be set BEFORE render to intercept window.setInterval
    vi.useFakeTimers();
    mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
    mockedApi.getCashSummary.mockResolvedValue(summaryResponse);

    await act(async () => {
      render(<HazipenztarWidget />);
      // Flush the initial useEffect's async fetch
      await vi.runAllTimersAsync();
    });

    expect(mockedApi.getCashEntries).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    // Assert synchronously — waitFor uses setInterval which is fake
    expect(mockedApi.getCashEntries).toHaveBeenCalledTimes(2);
    expect(mockedApi.getCashSummary).toHaveBeenCalledTimes(2);
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

  // ─── Error handling integration tests ────────────────────────────────────

  describe("API error handling", () => {
    it("shows error message when API load fails", async () => {
      mockedApi.getCashEntries.mockRejectedValue(new Error("Network timeout"));
      mockedApi.getCashSummary.mockRejectedValue(new Error("Network timeout"));

      await act(async () => {
        render(<HazipenztarWidget />);
      });

      await screen.findByText("Network timeout");
      expect(screen.getByText("Network timeout")).toBeInTheDocument();
    });

    it("shows loading badge 'BETÖLTÉS' before data arrives, then 'LIVE' after", async () => {
      let resolveFn!: (val: unknown) => void;
      mockedApi.getCashEntries.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve; })
      );
      mockedApi.getCashSummary.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve; })
      );

      render(<HazipenztarWidget />);

      expect(screen.getByText("BETÖLTÉS")).toBeInTheDocument();

      await act(async () => {
        resolveFn(summaryResponse);
        mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
        mockedApi.getCashSummary.mockResolvedValue(summaryResponse);
      });
    });

    it("shows 'Még nincs rögzített KP tétel.' when entries list is empty", async () => {
      mockedApi.getCashEntries.mockResolvedValue({ ...entriesResponse, entries: [], total: 0 });
      mockedApi.getCashSummary.mockResolvedValue(summaryResponse);

      await act(async () => {
        render(<HazipenztarWidget />);
      });

      await screen.findByText(/Még nincs rögzített KP tétel/);
      expect(screen.getByText(/Még nincs rögzített KP tétel/)).toBeInTheDocument();
    });

    it("calls toast.error when createCashEntry API fails", async () => {
      mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
      mockedApi.getCashSummary.mockResolvedValue(summaryResponse);
      mockedApi.createCashEntry.mockRejectedValue(new Error("Szerver hiba 500"));

      await act(async () => {
        render(<HazipenztarWidget />);
      });

      await screen.findByText("Irodaszer beszerzes");

      fireEvent.change(screen.getByLabelText("Dátum"), { target: { value: "2026-04-01" } });
      fireEvent.change(screen.getByLabelText("Összeg"), { target: { value: "500" } });
      fireEvent.change(screen.getByLabelText("Leírás"), { target: { value: "Teszt" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "KP tétel mentése" }));
      });

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith("Nem sikerült menteni: Szerver hiba 500");
      });
    });

    it("calls toast.error when toggleSyncState API fails", async () => {
      mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
      mockedApi.getCashSummary.mockResolvedValue(summaryResponse);
      mockedApi.updateCashEntry.mockRejectedValue(new Error("Frissítési hiba"));

      await act(async () => {
        render(<HazipenztarWidget />);
      });

      await screen.findByText("Irodaszer beszerzes");

      await act(async () => {
        fireEvent.click(screen.getAllByRole("button", { name: "Szinkronált" })[0]);
      });

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith("Nem sikerült frissíteni: Frissítési hiba");
      });
    });
  });

  // ─── Form validation integration tests ───────────────────────────────────

  describe("form validation", () => {
    beforeEach(async () => {
      mockedApi.getCashEntries.mockResolvedValue(entriesResponse);
      mockedApi.getCashSummary.mockResolvedValue(summaryResponse);

      await act(async () => {
        render(<HazipenztarWidget />);
      });
      await screen.findByText("Irodaszer beszerzes");
    });

    it("calls toast.error for zero amount", async () => {
      fireEvent.change(screen.getByLabelText("Összeg"), { target: { value: "0" } });
      fireEvent.change(screen.getByLabelText("Leírás"), { target: { value: "Teszt" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "KP tétel mentése" }));
      });

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith(
          "Nem sikerült menteni: Az összegnek pozitív számnak kell lennie."
        );
      });
      expect(mockedApi.createCashEntry).not.toHaveBeenCalled();
    });

    it("calls toast.error for non-numeric amount (NaN)", async () => {
      fireEvent.change(screen.getByLabelText("Összeg"), { target: { value: "abc" } });
      fireEvent.change(screen.getByLabelText("Leírás"), { target: { value: "Teszt" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "KP tétel mentése" }));
      });

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith(
          "Nem sikerült menteni: Az összegnek pozitív számnak kell lennie."
        );
      });
    });

    it("calls toast.error when description is empty", async () => {
      fireEvent.change(screen.getByLabelText("Összeg"), { target: { value: "1000" } });
      // description remains empty by default

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "KP tétel mentése" }));
      });

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith(
          "Nem sikerült menteni: A leírás megadása kötelező."
        );
      });
      expect(mockedApi.createCashEntry).not.toHaveBeenCalled();
    });
  });
});
