import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentRegistryCard } from "./AgentRegistryCard";

describe("AgentRegistryCard", () => {
  it("shows governance summary chips for the local registry snapshot", () => {
    render(<AgentRegistryCard />);

    expect(screen.getByText("Összes agent")).toBeInTheDocument();
    expect(
      screen.getByText("Aktív", {
        selector: 'div[class*="text-[10px]"][class*="text-zinc-500"]',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Inaktív", {
        selector: 'div[class*="text-[10px]"][class*="text-zinc-500"]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Duplikált nevek")).toBeInTheDocument();
  });
});
