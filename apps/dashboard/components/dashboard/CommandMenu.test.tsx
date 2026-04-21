import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAllItemsMock } = vi.hoisted(() => ({
  getAllItemsMock: vi.fn(),
}));

vi.mock("@/lib/navigation", () => ({
  navigationRegistry: {
    getAllItems: getAllItemsMock,
    getGroups: vi.fn(() => []),
    getItem: vi.fn(),
  },
}));

import { CommandMenu } from "./CommandMenu";

const DashIcon = () => <svg />;
const TaskIcon = () => <svg />;

describe("CommandMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllItemsMock.mockReturnValue([
      { id: "dashboard", label: "Mission Control", icon: DashIcon },
      { id: "tasks", label: "Task Queue", icon: TaskIcon },
      { id: "learning-loop", label: "Learning Loop", icon: DashIcon },
    ]);
  });

  it("renders the search trigger button", () => {
    render(<CommandMenu activeTab="dashboard" setActiveTab={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /Keresés/i });
    expect(trigger).toBeInTheDocument();
  });

  it("opens command dialog when trigger is clicked", async () => {
    render(<CommandMenu activeTab="dashboard" setActiveTab={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Keresés/i }));

    expect(await screen.findByText("Navigáció")).toBeInTheDocument();
    expect(screen.getByText("Mission Control")).toBeInTheDocument();
    expect(screen.getByText("Task Queue")).toBeInTheDocument();
    expect(screen.getByText("Learning Loop")).toBeInTheDocument();
  });

  it("selects an item and closes the dialog", async () => {
    const setActiveTab = vi.fn();
    render(<CommandMenu activeTab="dashboard" setActiveTab={setActiveTab} />);

    await userEvent.click(screen.getByRole("button", { name: /Keresés/i }));
    await userEvent.click(await screen.findByText("Learning Loop"));

    expect(setActiveTab).toHaveBeenCalledWith("learning-loop");
    await waitFor(() => {
      expect(screen.queryByText("Navigáció")).not.toBeInTheDocument();
    });
  });
});
