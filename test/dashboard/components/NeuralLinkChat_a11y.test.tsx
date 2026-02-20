import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
// Use the alias now
import { NeuralLinkChat } from "@/components/dashboard/NeuralLinkChat";

// Mock dependencies
vi.mock("@/lib/apiService", () => ({
  getOllamaModels: vi.fn().mockResolvedValue([]),
  getGithubModels: vi.fn().mockResolvedValue([]),
  getGeminiModels: vi.fn().mockResolvedValue([]),
  getCloudflareStatus: vi.fn().mockResolvedValue({ status: { enabled: false } }),
  getActiveTasks: vi.fn().mockResolvedValue([]),
  executeAgent: vi.fn(),
  getChatSession: vi.fn().mockReturnValue({}),
}));

// Mock loadChatSession to return a message with thoughts
vi.mock("@/lib/chat/sessionStore", () => ({
  loadChatSession: vi.fn().mockReturnValue({
    messages: [
      {
        role: "assistant",
        content: "Hello",
        thoughts: "Thinking...",
        timestamp: Date.now(),
      },
    ],
    mode: "orchestrator",
  }),
  saveChatSession: vi.fn(),
}));

// Mock other components if necessary to avoid rendering issues
vi.mock("@/components/dashboard/LiveExecutionMonitor", () => ({
  LiveExecutionMonitor: () => <div data-testid="live-monitor" />,
}));

describe("NeuralLinkChat Accessibility", () => {
  it("renders toggle button with correct ARIA attributes", () => {
    render(<NeuralLinkChat />);

    // Find the toggle button
    const toggleButton = screen.getByLabelText("Show thought process details");
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    fireEvent.click(toggleButton);

    // Check if it updated
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(toggleButton).toHaveAttribute("aria-label", "Hide thought process details");

    // Check if content is visible and has correct ID
    // The button has aria-controls="thought-content-0" (index 0)
    const contentId = toggleButton.getAttribute("aria-controls");
    expect(contentId).toBe("thought-content-0");

    // The content might be in the DOM now
    const content = document.getElementById(contentId!);
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("Thinking...");
  });
});
