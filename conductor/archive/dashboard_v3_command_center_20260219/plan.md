# Implementation Plan: Dashboard V3 "Command Center" (`dashboard_v3_command_center_20260219`)

**Objective:** Transform the current Mission Control Dashboard (v2.1) into a modular, customizable "Command Center" for real-time process control and improved code hygiene.

---

## Phase 1: The "Smart Grid" Architecture (Layout & Positioning)

**Goal:** Implement a Context-Aware Layout Engine for dynamic module arrangement based on user focus.

**Steps:**
1.  **Analyze existing layout:** Review `src/dashboard/components/dashboard/MissionControlLayout.tsx` and related components to understand current layout structure.
2.  **Design layout engine:** Define the data structure for layout configurations (e.g., `Dev Mode`, `Ops Mode`) and how to switch between them.
3.  **Implement React Context API:** Create a new React Context (`LayoutContext.tsx`) to manage the active layout mode and provide functions to switch modes.
4.  **Dynamic CSS Grid Area manipulation:** Modify `MissionControlLayout.tsx` to use CSS Grid and dynamically assign `grid-area` values to dashboard modules based on the active layout mode from `LayoutContext`.
5.  **Refactor existing widgets:** Adapt current dashboard widgets to be compatible with the new layout engine, ensuring they can receive `grid-area` props.
6.  **Create layout switcher UI:** Add a simple UI element (e.g., buttons, dropdown) to the dashboard to allow users to switch between predefined layout modes.
7.  **Unit Tests:** Write unit tests for `LayoutContext` and `MissionControlLayout.tsx` to ensure dynamic layout changes function correctly.

---

## Phase 2: Unified Signal Bus (Wiring Perfection)

**Goal:** Create a central `useSystemSignal` React hook for synchronized real-time data, with REST polling fallback.

**Steps:**
1.  **Analyze existing data flows:** Identify all current Socket.IO event listeners and REST API polling mechanisms (`useMCP`, `useSocket`, `apiService`).
2.  **Design `useSystemSignal` hook:** Define the API of the hook, including how it subscribes to different data streams (Logs, AgentStatus, TaskQueue).
3.  **Implement WebSocket (Socket.IO) integration:** Configure the hook to listen to relevant Socket.IO events and update a Zustand store.
4.  **Implement REST polling fallback:** If the WebSocket connection is lost, switch to a periodic REST API polling mechanism for critical data. Implement retry logic and automatic reconnection.
5.  **Implement Zustand store:** Create a central Zustand store to hold the "Single Source of Truth" for all real-time dashboard data. All data from WebSockets or REST polling should update this store.
6.  **Integrate `useSystemSignal` into widgets:** Replace direct Socket.IO and REST API calls in existing and new widgets with calls to `useSystemSignal`.
7.  **Error handling and logging:** Ensure robust error handling within the hook and comprehensive logging for connection status and data updates.
8.  **Unit Tests:** Write unit tests for `useSystemSignal`, covering WebSocket connection, fallback to REST polling, and Zustand store updates.

---

## Phase 3: The Process Governor (Control at All Levels)

**Goal:** Develop `ProcessControlWidget` for live intervention, deep dive tracing, and task prioritization.

**Steps:**
1.  **Design `ProcessControlWidget` UI:** Create wireframes/mockups for the widget, including buttons for control actions, display area for processes, and task queue visualization.
2.  **Implement Live Intervention buttons:** Add `PAUSE`, `RESUME`, `KILL`, `RETRY w/ DEBUG` buttons. These buttons will dispatch actions to the backend (via `useSystemSignal` or a dedicated API service).
3.  **Backend API for process control:** Develop new REST API endpoints (or Socket.IO events) in `src/server/routes/` to handle `PAUSE`, `RESUME`, `KILL`, `RETRY` actions for agents/tasks.
4.  **Deep Dive Trace integration:** Implement functionality to display full traces (e.g., from LangSmith or OpenTelemetry) when a process is clicked. This might involve integrating with an external trace visualization library or component.
5.  **Drag-and-drop Task Queue:** Implement drag-and-drop functionality for the Task Queue to allow users to change task priority. This will require backend support for reordering tasks.
6.  **Unit Tests & Integration Tests:** Write unit tests for `ProcessControlWidget` and integration tests to verify that control actions correctly interact with the backend and update the UI.

---

## Phase 4: Self-Maintenance & Health (Maintenance)

**Goal:** Integrate a UI Test Suite within the Dashboard for client-side diagnostics.

**Steps:**
1.  **Design "Admin/Self-Check" UI:** Create a hidden or password-protected tab/section in the Dashboard for self-maintenance checks.
2.  **Implement client-side diagnostics:** Develop functions to perform checks:
    *   Backend connectivity (ping API endpoint).
    *   Component rendering verification (render critical components and check for errors).
    *   Socket responsiveness (send a test message and await a response).
3.  **Integrate test runner:** Use a client-side testing library (e.g., Vitest in a browser environment, or a custom test runner) to execute these diagnostics on demand.
4.  **Display test results:** Present the results of the diagnostics in a clear, user-friendly format within the "Admin/Self-Check" tab.
5.  **CLI Integration for Dashboard Status:** Develop a new CLI command (`brunella dashboard status`) that can remotely trigger these diagnostics or retrieve the last-run status from the backend. This requires a new API endpoint.
6.  **Unit Tests:** Write unit tests for the diagnostic functions and their integration.

---

## Definition of Done (Acceptance Criteria):

-   `src/dashboard/components/dashboard/` is restructured into modular widgets.
-   `MissionControlLayout.tsx` is refactored to use the new Grid Engine.
-   All API calls are type-safe and error-tolerant.
-   The dashboard status can be queried from the CLI (`brunella dashboard status`).
