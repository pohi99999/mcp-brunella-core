import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMProvidersPanel } from "@/components/dashboard/LLMProvidersPanel";
import { toast } from "sonner";
import type { ProviderStatus } from "@/lib/apiService";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import * as api from "@/lib/apiService";
vi.mock("@/lib/apiService", () => ({
  getProvidersStatus: vi.fn(),
}));

const mockedApi = api as unknown as {
  getProvidersStatus: ReturnType<typeof vi.fn>;
};
type ToastMock = { error: ReturnType<typeof vi.fn> };
const mockedToast = toast as unknown as ToastMock;

const makeProvider = (overrides: Partial<ProviderStatus> = {}): ProviderStatus => ({
  id: "ollama",
  name: "Ollama Local",
  status: "online",
  latency: 42,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getProvidersStatus.mockResolvedValue([]);
});

describe("LLMProvidersPanel", () => {
  it("renders header and refresh button", async () => {
    await act(async () => { render(<LLMProvidersPanel />); });
    expect(screen.getByText("LLM Providers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });

  it("shows provider cards with name and status badge", async () => {
    mockedApi.getProvidersStatus.mockResolvedValue([
      makeProvider({ id: "ollama", name: "Ollama Local", status: "online" }),
      makeProvider({ id: "gemini", name: "Gemini Cloud", status: "offline", latency: undefined }),
    ]);
    await act(async () => { render(<LLMProvidersPanel />); });
    await waitFor(() => expect(screen.getByText("Ollama Local")).toBeInTheDocument());
    expect(screen.getByText("Gemini Cloud")).toBeInTheDocument();
  });

  it("online provider shows latency in ms", async () => {
    mockedApi.getProvidersStatus.mockResolvedValue([
      makeProvider({ status: "online", latency: 85 }),
    ]);
    await act(async () => { render(<LLMProvidersPanel />); });
    await waitFor(() => expect(screen.getByText("85ms")).toBeInTheDocument());
  });

  it("offline provider shows N/A for latency", async () => {
    mockedApi.getProvidersStatus.mockResolvedValue([
      makeProvider({ status: "offline", latency: 0 }),
    ]);
    await act(async () => { render(<LLMProvidersPanel />); });
    await waitFor(() => expect(screen.getByText("N/A")).toBeInTheDocument());
  });

  it("shows per-provider error message", async () => {
    mockedApi.getProvidersStatus.mockResolvedValue([
      makeProvider({ status: "offline", error: "Connection refused at port 11434" }),
    ]);
    await act(async () => { render(<LLMProvidersPanel />); });
    await waitFor(() =>
      expect(screen.getByText("Connection refused at port 11434")).toBeInTheDocument()
    );
  });

  it("shows toast.error when getProvidersStatus throws", async () => {
    mockedApi.getProvidersStatus.mockRejectedValue(new Error("Network timeout"));
    await act(async () => { render(<LLMProvidersPanel />); });
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith(
        "Hiba a lekérdezés során: Network timeout"
      )
    );
  });

  it("refresh button is disabled while loading", async () => {
    let resolveFn!: (v: ProviderStatus[]) => void;
    mockedApi.getProvidersStatus.mockImplementation(
      () => new Promise<ProviderStatus[]>((res) => { resolveFn = res; })
    );
    await act(async () => { render(<LLMProvidersPanel />); });
    expect(screen.getByRole("button", { name: /refresh/i })).toBeDisabled();
    await act(async () => { resolveFn([]); });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /refresh/i })).not.toBeDisabled()
    );
  });

  it("clicking refresh button calls getProvidersStatus again", async () => {
    mockedApi.getProvidersStatus.mockResolvedValue([]);
    await act(async () => { render(<LLMProvidersPanel />); });
    await waitFor(() =>
      expect(mockedApi.getProvidersStatus).toHaveBeenCalledTimes(1)
    );
    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() =>
      expect(mockedApi.getProvidersStatus).toHaveBeenCalledTimes(2)
    );
  });

  it("sets up a 30s polling interval", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    render(<LLMProvidersPanel />);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 30000);
    spy.mockRestore();
  });
});
