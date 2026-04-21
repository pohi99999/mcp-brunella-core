import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../../../src/dashboard/ErrorFallback.js";
import React from "react";

// Mocking the UI components if needed, or if they are simple enough just let them render.
// Since ErrorFallback imports from ./components/ui/alert, we might need to mock them if they fail to load in test environment.

const ProblematicComponent = () => {
  throw new Error("UI Crash Test");
};

describe("Dashboard ErrorBoundary & Fallback", () => {
  it("should catch errors and show the fallback UI", () => {
    // We need to mock import.meta.env.DEV as false for the fallback to show
    // @ts-expect-error - mocking environment
    global.import = { meta: { env: { DEV: false } } };

    // Prevent console.error from cluttering the output during intentional crashes
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ProblematicComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/runtime error/i)).toBeInTheDocument();
    expect(screen.getByText(/UI Crash Test/i)).toBeInTheDocument();
    expect(screen.getByText(/Try Again/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("should call resetErrorBoundary when Try Again is clicked", () => {
    const resetSpy = vi.fn();
    const error = new Error("Sample Error");

    render(<ErrorFallback error={error} resetErrorBoundary={resetSpy} />);

    const tryAgainButton = screen.getByText(/Try Again/i);
    fireEvent.click(tryAgainButton);

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});
