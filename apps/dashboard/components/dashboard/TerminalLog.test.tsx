import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSystemSignalMock } = vi.hoisted(() => ({
  useSystemSignalMock: vi.fn(),
}));

vi.mock("@/hooks/useSystemSignal", () => ({
  useSystemSignal: () => useSystemSignalMock(),
}));

import { TerminalLog } from "./TerminalLog";

function createLog(id: string, message: string) {
  return {
    id,
    message,
    source: "system",
    type: "info" as const,
    timestamp: "2026-04-04T12:00:00.000Z",
  };
}

describe("TerminalLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSystemSignalMock.mockReturnValue({ logs: [] });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("auto-scrolls when the viewport is near the bottom", async () => {
    const { container, rerender } = render(<TerminalLog logs={[createLog("1", "first")]} />);
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement;

    Object.defineProperty(viewport, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(viewport, "scrollHeight", { value: 160, configurable: true });
    Object.defineProperty(viewport, "scrollTop", { value: 55, writable: true, configurable: true });

    viewport.dispatchEvent(new Event("scroll"));
    vi.mocked(window.HTMLElement.prototype.scrollIntoView).mockClear();

    rerender(<TerminalLog logs={[createLog("1", "first"), createLog("2", "second")]} />);

    await waitFor(() => {
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });
  });

  it("does not auto-scroll when the user has scrolled away from the bottom", () => {
    const { container, rerender } = render(<TerminalLog logs={[createLog("1", "first")]} />);
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement;

    Object.defineProperty(viewport, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(viewport, "scrollHeight", { value: 400, configurable: true });
    Object.defineProperty(viewport, "scrollTop", { value: 0, writable: true, configurable: true });

    viewport.dispatchEvent(new Event("scroll"));
    vi.mocked(window.HTMLElement.prototype.scrollIntoView).mockClear();

    rerender(<TerminalLog logs={[createLog("1", "first"), createLog("2", "second")]} />);

    expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
