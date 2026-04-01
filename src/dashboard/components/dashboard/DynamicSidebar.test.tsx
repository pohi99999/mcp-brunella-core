import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted() — mock adatok early binding, mielőtt a vi.mock() factory-k futnak
const { mockGroups, mockItems, mockGetGroups, mockGetAllItems } = vi.hoisted(() => {
  const dashboardIcon = () => <svg aria-label="icon-dashboard" />;
  const tasksIcon = () => <svg aria-label="icon-tasks" />;
  const cloudIcon = () => <svg aria-label="icon-cloud" />;
  const groupIcon = () => <svg aria-label="icon-group" />;

  const items = [
    { id: "dashboard", label: "Mission Control", icon: dashboardIcon, component: null },
    { id: "tasks", label: "Task Queue", icon: tasksIcon, component: null },
    { id: "cloudflare", label: "Cloudflare Deploy", icon: cloudIcon, component: null },
  ];

  const groups = [
    { title: "Core Systems", icon: groupIcon, items: ["cloudflare"] },
    { title: "Operations", icon: groupIcon, items: ["tasks"] },
  ];

  return {
    mockGroups: groups,
    mockItems: items,
    mockGetGroups: vi.fn(() => groups),
    mockGetAllItems: vi.fn(() => items),
  };
});

// navigationRegistry mock — a valódi singleton helyett a mock verziót használjuk
vi.mock("@/lib/navigation", () => ({
  navigationRegistry: {
    getGroups: mockGetGroups,
    getAllItems: mockGetAllItems,
  },
}));

import { DynamicSidebar } from "./DynamicSidebar";

describe("DynamicSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGroups.mockReturnValue(mockGroups);
    mockGetAllItems.mockReturnValue(mockItems);
  });

  it("renders group titles from navigationRegistry", () => {
    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    expect(screen.getByText("Core Systems")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
  });

  it("renders navigation items as buttons with aria-label", () => {
    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Cloudflare Deploy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Task Queue" })).toBeInTheDocument();
  });

  it("calls onTabChange with item id when a navigation button is clicked", async () => {
    const onTabChange = vi.fn();
    render(<DynamicSidebar activeTab="dashboard" onTabChange={onTabChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Cloudflare Deploy" }));

    expect(onTabChange).toHaveBeenCalledWith("cloudflare");
  });

  it("calls onTabChange with the correct id for multiple items", async () => {
    const onTabChange = vi.fn();
    render(<DynamicSidebar activeTab="dashboard" onTabChange={onTabChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Task Queue" }));
    expect(onTabChange).toHaveBeenCalledWith("tasks");
  });

  it("applies active styling class to the currently active item", () => {
    render(<DynamicSidebar activeTab="cloudflare" onTabChange={vi.fn()} />);

    const activeBtn = screen.getByRole("button", { name: "Cloudflare Deploy" });
    // Az aktív gomb bg-cyan-300/[0.1] osztályt kap
    expect(activeBtn.className).toContain("bg-cyan-300");
  });

  it("does not apply active styling to inactive items", () => {
    render(<DynamicSidebar activeTab="cloudflare" onTabChange={vi.fn()} />);

    const inactiveBtn = screen.getByRole("button", { name: "Task Queue" });
    expect(inactiveBtn.className).not.toContain("bg-cyan-300");
  });

  it("updates active item styling when activeTab prop changes", () => {
    const { rerender } = render(
      <DynamicSidebar activeTab="tasks" onTabChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Task Queue" }).className).toContain("bg-cyan-300");

    rerender(<DynamicSidebar activeTab="cloudflare" onTabChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Cloudflare Deploy" }).className).toContain("bg-cyan-300");
    expect(screen.getByRole("button", { name: "Task Queue" }).className).not.toContain("bg-cyan-300");
  });

  it("renders the footer with Master Admin identity", () => {
    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    expect(screen.getByText("Master Admin")).toBeInTheDocument();
    expect(screen.getByText("AUTHORIZED")).toBeInTheDocument();
  });

  it("renders the Disconnect button in the footer", () => {
    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("renders nothing for a group item whose id is not in getAllItems", () => {
    mockGetGroups.mockReturnValue([
      { title: "Ghost Group", icon: () => <svg />, items: ["nonexistent-item"] },
    ]);
    mockGetAllItems.mockReturnValue([]);

    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    expect(screen.getByText("Ghost Group")).toBeInTheDocument();
    // No buttons except Disconnect footer button
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1); // only Disconnect
  });

  it("renders all items from multiple groups without duplication", () => {
    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    // Cloudflare in Core Systems, Tasks in Operations
    const cloudflareButtons = screen.getAllByRole("button", { name: "Cloudflare Deploy" });
    const tasksButtons = screen.getAllByRole("button", { name: "Task Queue" });

    expect(cloudflareButtons).toHaveLength(1);
    expect(tasksButtons).toHaveLength(1);
  });

  it("renders with empty groups without crashing", () => {
    mockGetGroups.mockReturnValue([]);
    mockGetAllItems.mockReturnValue([]);

    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    // Footer still renders
    expect(screen.getByText("Master Admin")).toBeInTheDocument();
  });

  it("renders the Navigation section header text", () => {
    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Operator sections")).toBeInTheDocument();
  });

  it("item title attribute matches item label for tooltip accessibility", () => {
    render(<DynamicSidebar activeTab="dashboard" onTabChange={vi.fn()} />);

    const btn = screen.getByRole("button", { name: "Cloudflare Deploy" });
    expect(btn).toHaveAttribute("title", "Cloudflare Deploy");
  });
});
