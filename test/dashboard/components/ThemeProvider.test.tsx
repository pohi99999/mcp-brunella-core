/**
 * ThemeProvider unit tests
 *
 * Covers the custom src/dashboard/components/theme-provider.tsx.
 * This is the project's own React context provider (NOT next-themes);
 * it reads/writes localStorage and applies CSS classes to <html>.
 *
 * NOTE: window.matchMedia is already mocked in test/dashboard/setup.ts
 * to return { matches: false }, so "system" resolves to the "light" class.
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

// ── helpers ────────────────────────────────────────────────────────────────

/** A minimal consumer that shows the current theme and lets us change it. */
function ThemeConsumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={() => setTheme("dark")}>Set Dark</button>
      <button onClick={() => setTheme("light")}>Set Light</button>
      <button onClick={() => setTheme("system")}>Set System</button>
    </div>
  );
}

// ── setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  // Start each test with a clean <html> class list
  document.documentElement.classList.remove("light", "dark");
});

afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
});

// ── tests ──────────────────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  it("renders children without crashing", () => {
    render(<ThemeProvider><span>hello</span></ThemeProvider>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("defaults to 'system' theme when localStorage is empty", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value").textContent).toBe("system");
  });

  it("reads persisted 'dark' theme from localStorage on mount", () => {
    localStorage.setItem("vite-ui-theme", "dark");
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
  });

  it("reads persisted 'light' theme from localStorage on mount", () => {
    localStorage.setItem("vite-ui-theme", "light");
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value").textContent).toBe("light");
  });

  it("respects a custom storageKey prop", () => {
    localStorage.setItem("my-app-theme", "dark");
    render(
      <ThemeProvider storageKey="my-app-theme">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
  });

  it("setTheme updates context value and persists to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText("Set Dark").click();
    });
    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark");
  });

  it("applies 'dark' class to <html> when defaultTheme='dark'", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("applies 'light' class to <html> when setTheme('light') is called", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText("Set Light").click();
    });
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("removes old theme class when switching from dark to light", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    act(() => {
      screen.getByText("Set Light").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("system theme applies 'light' class when matchMedia reports no dark preference", () => {
    // setup.ts mocks matchMedia to always return { matches: false }
    // so "prefers-color-scheme: dark" → false → system resolves to "light"
    render(
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("system theme applies 'dark' class when matchMedia reports dark preference", () => {
    // Override the matchMedia mock for this test only
    const original = window.matchMedia;
    (window as Window).matchMedia = vi.fn().mockImplementation(() => ({
      matches: true, // dark mode preferred
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // restore
    (window as Window).matchMedia = original;
  });
});
