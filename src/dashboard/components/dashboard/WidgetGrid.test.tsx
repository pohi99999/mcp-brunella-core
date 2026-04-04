import type { HTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetLayoutMode = vi.fn();
const mockMatchMedia = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/lib/layout/LayoutContext", () => ({
  useLayout: () => ({
    currentLayout: {
      name: "Mission Control",
      gridTemplateAreas: ['"hero side"', '"hero queue"'],
      gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
      gridTemplateRows: "minmax(0,1fr) minmax(0,1fr)",
      widgetAssignments: {
        hero: "hero",
        queue: "queue",
      },
    },
    setLayoutMode: mockSetLayoutMode,
  }),
}));

vi.mock("@/hooks/useSystemSignal", () => ({
  useSystemSignal: () => ({
    agents: new Map([
      ["a1", { status: "working" }],
      ["a2", { status: "idle" }],
    ]),
    taskStats: {
      pendingCount: 2,
      runningCount: 1,
      successRate: 93,
      total: 10,
    },
    healthStatus: {
      status: "ok",
      services: {
        core: "healthy",
        python: { status: "ok" },
      },
    },
  }),
}));

vi.mock("@/lib/widgetRegistry", () => ({
  WIDGET_REGISTRY: {
    hero: {
      component: () => <div>Hero Widget</div>,
    },
    queue: {
      component: () => <div>Queue Widget</div>,
    },
  },
}));

import { WidgetGrid } from "./WidgetGrid";

describe("WidgetGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockMatchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });
  });

  it("keeps the explicit dashboard grid contract on wide viewports", () => {
    render(<WidgetGrid />);

    const heroCard = screen.getByText("Hero Widget").closest(".widget-card") as HTMLElement;
    const grid = heroCard.parentElement;

    expect(grid).not.toBeNull();
    expect(grid?.getAttribute("style") ?? "").toContain('grid-template-areas: "hero side" "hero queue";');
    expect(grid?.getAttribute("style") ?? "").toContain("grid-template-columns: minmax(0,2fr) minmax(0,1fr);");
    expect(heroCard.style.gridArea).toBe("hero");
  });

  it("falls back to a compact auto-fit grid on narrow viewports", () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query.includes("1279px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<WidgetGrid />);

    const heroCard = screen.getByText("Hero Widget").closest(".widget-card") as HTMLElement;
    const grid = heroCard.parentElement;

    expect(grid).not.toBeNull();
    expect(grid?.getAttribute("style") ?? "").toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));");
    expect(grid?.getAttribute("style") ?? "").toContain("grid-auto-rows: minmax(16rem, auto);");
    expect(heroCard.getAttribute("style") ?? "").not.toContain("grid-area");
  });

  it("resets the layout to the default dashboard mode", () => {
    render(<WidgetGrid />);

    fireEvent.click(screen.getByRole("button", { name: /reset view/i }));

    expect(mockSetLayoutMode).toHaveBeenCalledWith("default-dashboard");
  });
});
