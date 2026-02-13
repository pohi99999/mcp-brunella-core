import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import React from "react";
import { NeuralLinkChat } from "@/components/dashboard/NeuralLinkChat";
import * as api from "@/lib/apiService";

vi.mock("@/lib/apiService", () => ({
  getOllamaModels: vi.fn().mockResolvedValue([{ name: "llama3" }]),
  getGithubModels: vi
    .fn()
    .mockResolvedValue([{ name: "gpt-4.1", provider: "github" }]),
  getGeminiModels: vi
    .fn()
    .mockResolvedValue([
      { name: "gemini-2.5-pro", provider: "gemini", tier: "pro" },
    ]),
  getCloudflareStatus: vi
    .fn()
    .mockResolvedValue({ status: { enabled: false, healthy: false } }),
  executeAgent: vi.fn().mockResolvedValue({ message: "Szia!" }),
  generateWithOllama: vi.fn().mockResolvedValue("Ollama válasz"),
  generateWithGithubModels: vi.fn().mockResolvedValue("GitHub válasz"),
  generateWithGemini: vi.fn().mockResolvedValue("Gemini válasz"),
  submitCloudflareTask: vi.fn().mockResolvedValue({
    success: true,
    taskId: "task-1",
    type: "chat",
    message: "ok",
    result: "Edge válasz",
  }),
  chatWithCloudflare: vi.fn().mockResolvedValue({
    success: true,
    message: "CF chat",
    endpoint: "/api/chat",
  }),
}));

const mockedApi = api as unknown as {
  executeAgent: ReturnType<typeof vi.fn>;
};

describe("NeuralLinkChat", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("restores session state from localStorage", async () => {
    localStorage.setItem(
      "brunella:chat:session:v1",
      JSON.stringify({
        mode: "github",
        messages: [
          {
            role: "assistant",
            content: "Üdv!",
            timestamp: Date.now(),
          },
        ],
        selectedModel: "",
        selectedGhModel: "gpt-4.1",
        selectedGeminiModel: "",
      }),
    );

    await act(async () => {
      render(<NeuralLinkChat />);
    });

    expect(screen.getByText("Üdv!")).toBeInTheDocument();
    const modeSelect = screen.getByLabelText("Chat mód") as HTMLSelectElement;
    expect(modeSelect.value).toBe("github");
  });

  it("sends message via orchestrator provider", async () => {
    await act(async () => {
      render(<NeuralLinkChat />);
    });

    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "Szia" } });

    const sendButton = screen.getByRole("button");
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Szia!")).toBeInTheDocument();
    });

    expect(mockedApi.executeAgent).toHaveBeenCalledWith(
      "Orchestrator",
      "Szia",
      expect.objectContaining({ chatMode: "orchestrator" }),
    );
  });

  it("shows edge status indicator in cloudflare mode", async () => {
    await act(async () => {
      render(<NeuralLinkChat />);
    });

    const modeSelect = screen.getByLabelText("Chat mód") as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: "cloudflare" } });

    await waitFor(() => {
      expect(screen.getByText("Disabled")).toBeInTheDocument();
    });
  });
});
