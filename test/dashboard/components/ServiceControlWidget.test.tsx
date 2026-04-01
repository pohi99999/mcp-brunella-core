import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceControlWidget } from "@/components/dashboard/ServiceControlWidget";
import * as api from "@/lib/apiService";
import { toast } from "sonner";

vi.mock("@/lib/apiService", () => ({
  getServiceStatus: vi.fn(),
  startService: vi.fn(),
  stopService: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getServiceStatus: ReturnType<typeof vi.fn>;
  startService: ReturnType<typeof vi.fn>;
  stopService: ReturnType<typeof vi.fn>;
};

type ToastMock = {
  info: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};
const mockedToast = toast as unknown as ToastMock;

const ollamaOnline: api.ServiceState = { id: "ollama", status: "online", pid: 1234 };
const pythonOffline: api.ServiceState = { id: "python", status: "offline" };
const anythingllmOnline: api.ServiceState = { id: "anythingllm", status: "online" };

describe("ServiceControlWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows placeholder text when no services are loaded yet", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([]);
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await waitFor(() => expect(mockedApi.getServiceStatus).toHaveBeenCalledOnce());
    expect(screen.getByText("Szolgáltatások betöltése...")).toBeInTheDocument();
  });

  it("renders service labels and status emoji from API response", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([ollamaOnline, pythonOffline, anythingllmOnline]);
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Ollama");
    expect(screen.getByText("Python Subsystem")).toBeInTheDocument();
    expect(screen.getByText("AnythingLLM")).toBeInTheDocument();
    expect(screen.getAllByText("🟢").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("🔴")).toBeInTheDocument();
  });

  it("shows toast.error when getServiceStatus throws", async () => {
    mockedApi.getServiceStatus.mockRejectedValue(new Error("network fail"));
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Státusz lekérés sikertelen"),
    );
  });

  it("calls getServiceStatus again when refresh button is clicked", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([ollamaOnline]);
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Ollama");
    expect(mockedApi.getServiceStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(mockedApi.getServiceStatus).toHaveBeenCalledTimes(2);
  });

  it("calls stopService when toggling an online service off", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([ollamaOnline]);
    mockedApi.stopService.mockResolvedValue({ success: true, message: "Ollama leállítva" });
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Ollama");

    const [serviceSwitch] = screen.getAllByRole("switch");
    await act(async () => {
      fireEvent.click(serviceSwitch);
    });
    expect(mockedApi.stopService).toHaveBeenCalledWith("ollama");
    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Ollama leállítva"),
    );
  });

  it("calls startService when toggling an offline service on", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([pythonOffline]);
    mockedApi.startService.mockResolvedValue({ success: true, message: "Python elindult" });
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Python Subsystem");

    const [serviceSwitch] = screen.getAllByRole("switch");
    await act(async () => {
      fireEvent.click(serviceSwitch);
    });
    expect(mockedApi.startService).toHaveBeenCalledWith("python");
    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Python elindult"),
    );
  });

  it("shows toast.error when startService returns success: false", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([pythonOffline]);
    mockedApi.startService.mockResolvedValue({ success: false, message: "Port foglalt" });
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Python Subsystem");

    const [serviceSwitch] = screen.getAllByRole("switch");
    await act(async () => {
      fireEvent.click(serviceSwitch);
    });
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Port foglalt"),
    );
    expect(mockedApi.startService).toHaveBeenCalledWith("python");
  });

  it("shows toast.error when toggle throws an exception", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([ollamaOnline]);
    mockedApi.stopService.mockRejectedValue(new Error("Connection refused"));
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Ollama");

    const [serviceSwitch] = screen.getAllByRole("switch");
    await act(async () => {
      fireEvent.click(serviceSwitch);
    });
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Connection refused"),
    );
  });

  it("shows info toast and does NOT call stopService for AnythingLLM", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([anythingllmOnline]);
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("AnythingLLM");

    const [serviceSwitch] = screen.getAllByRole("switch");
    await act(async () => {
      fireEvent.click(serviceSwitch);
    });
    expect(mockedToast.info).toHaveBeenCalledWith(
      "AnythingLLM Desktop app – manuálisan zárd be",
    );
    expect(mockedApi.stopService).not.toHaveBeenCalled();
  });

  it("disables switch while a toggle operation is in progress", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([ollamaOnline]);
    let resolveFn!: (v: { success: boolean; message: string }) => void;
    mockedApi.stopService.mockImplementation(
      () =>
        new Promise<{ success: boolean; message: string }>((res) => {
          resolveFn = res;
        }),
    );

    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Ollama");

    const [serviceSwitch] = screen.getAllByRole("switch");
    expect(serviceSwitch).not.toBeDisabled();

    act(() => {
      fireEvent.click(serviceSwitch);
    });
    await waitFor(() => expect(serviceSwitch).toBeDisabled());

    await act(async () => {
      resolveFn({ success: true, message: "OK" });
    });
    await waitFor(() => expect(serviceSwitch).not.toBeDisabled());
  });

  it("shows 'Indul...' badge for a service in starting state", async () => {
    const starting: api.ServiceState = { id: "ollama", status: "starting" };
    mockedApi.getServiceStatus.mockResolvedValue([starting]);
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Indul...");
    expect(screen.getByText("Indul...")).toBeInTheDocument();
  });

  it("shows 'Leáll...' badge for a service in stopping state", async () => {
    const stopping: api.ServiceState = { id: "ollama", status: "stopping" };
    mockedApi.getServiceStatus.mockResolvedValue([stopping]);
    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Leáll...");
    expect(screen.getByText("Leáll...")).toBeInTheDocument();
  });

  it("re-fetches services via setInterval", async () => {
    mockedApi.getServiceStatus.mockResolvedValue([ollamaOnline]);
    const callbacks: Array<() => void> = [];
    const spy = vi.spyOn(window, "setInterval").mockImplementation((cb: TimerHandler) => {
      callbacks.push(cb as () => void);
      return 99 as unknown as number;
    });

    await act(async () => {
      render(<ServiceControlWidget />);
    });
    await screen.findByText("Ollama");
    expect(mockedApi.getServiceStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await callbacks[0]?.();
    });
    expect(mockedApi.getServiceStatus).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });
});
