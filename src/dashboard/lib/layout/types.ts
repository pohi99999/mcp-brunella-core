export type LayoutModeId = 'default-dashboard' | 'dev-mode' | 'ops-mode' | 'focused-mode';

export interface LayoutMode {
  id: LayoutModeId;
  name: string; // e.g., "Default Dashboard", "Developer Mode"
  description: string;
  gridTemplateAreas: string[]; // Array of strings for grid-template-areas
  gridTemplateColumns?: string; // Optional: e.g., "1fr 3fr 1fr"
  gridTemplateRows?: string;    // Optional: e.g., "auto 1fr auto"
  widgetAssignments: {
    [widgetId: string]: string; // Maps widget ID to a grid-area name
  };
}

export interface DashboardLayoutConfig {
  modes: LayoutMode[];
  defaultMode: LayoutModeId;
}
